import { readFile } from 'node:fs/promises';

type Release = { name: string; version: string; specifier: string; timestamp: number; published: string };
type Post = { user?: { login: string }; body?: string | null };
type Issue = Post & {
  number: number;
  state: string;
  assignees?: { login: string }[];
  pull_request?: unknown;
};
type NpmMetadata = { versions?: Record<string, unknown>; time?: Record<string, string> };

const assignee = 'stefashkaa';
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');

const githubApi = `${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repository}`;
const packages = ['webmcp-types', '@types/dom-chromium-ai'];
const issueMarker = '<!-- browser-ai:type-package-updates -->';
const versionPattern = /^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?(?:\+[\da-zA-Z.-]+)?$/;
const releaseMarker = ({ name, version }: Release) => `<!-- browser-ai:type-package-release ${name}@${version} -->`;
const isMonitorPost = (post: Post) => post.user?.login === 'github-actions[bot]';

async function githubRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(`${githubApi}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path} failed: HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

async function listGithub<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await githubRequest<T[]>(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

async function findReleases(name: string, specifier: string | undefined): Promise<Release[]> {
  const baseline = specifier?.replace(/^[~^]/, '');
  if (!specifier || !baseline || !versionPattern.test(baseline)) {
    throw new Error(`Expected an exact, caret, or tilde version for ${name}; received ${specifier}.`);
  }

  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`npm metadata request failed for ${name}: HTTP ${response.status}.`);
  const metadata = (await response.json()) as NpmMetadata;
  const baselineTime = Date.parse(metadata.time?.[baseline] ?? '');
  if (!metadata.versions?.[baseline] || !Number.isFinite(baselineTime)) {
    throw new Error(`npm metadata does not contain the declared ${name}@${baseline} and its publication date.`);
  }

  // Publication dates also catch prereleases and releases on older version lines.
  // Notify immediately; pnpm's release-age policy still governs installation.
  return Object.keys(metadata.versions)
    .map((version) => {
      const timestamp = Date.parse(metadata.time?.[version] ?? '');
      if (!versionPattern.test(version) || !Number.isFinite(timestamp)) {
        throw new Error(`Invalid npm version or publication date for ${name}@${version}.`);
      }
      return { name, version, specifier, timestamp, published: new Date(timestamp).toISOString() };
    })
    .filter((release) => release.timestamp > baselineTime)
    .sort((a, b) => a.timestamp - b.timestamp || a.version.localeCompare(b.version));
}

function notificationBody(releases: Release[]) {
  const runUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  return [
    `@${assignee}, please investigate these npm releases and add or adjust Browser AI Kit support where needed.`,
    '',
    'These type packages define APIs used throughout the library. A release may introduce backward incompatibilities or new browser features.',
    '',
    '| Package | Published version | Declared dependency | Published at (UTC) |',
    '| --- | --- | --- | --- |',
    ...releases.map(
      ({ name, version, specifier, published }) =>
        `| \`${name}\` | [\`${version}\`](https://www.npmjs.com/package/${name}/v/${version}) | \`${specifier}\` | ${published} |`
    ),
    '',
    '- [ ] Compare the published declarations with the declared versions and review upstream specifications and release notes.',
    '- [ ] Identify changed signatures, removals, renames, new APIs, and browser compatibility requirements.',
    '- [ ] Review the core controllers and Vue, React, Svelte, Angular, and Nuxt adapters; implement needed support and update demos and documentation.',
    '- [ ] Add relevant type and runtime regression coverage; run `pnpm check:peers`, `pnpm audit:prod`, and the applicable CI checks. Record any existing blockers.',
    '- [ ] Record whether an API migration or new feature support is needed, including a reason when no code change is necessary.',
    '',
    'This monitor includes prereleases and does not install packages. Apply updates only after they satisfy the repository’s pnpm release-age and peer-dependency rules.',
    '',
    `Detected by the [daily type-package monitor](${runUrl}). Close this issue after investigation; an unreported release will reopen it.`,
    '',
    ...releases.map(releaseMarker)
  ].join('\n');
}

async function checkTypeUpdates() {
  const manifest = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  // Fetch both registries before writing anything, so a failed check cannot post a partial report.
  const releases = (
    await Promise.all(packages.map((name) => findReleases(name, manifest.dependencies?.[name])))
  ).flat();
  if (!releases.length) {
    console.info('No type-package releases have been published after the declared versions.');
    return;
  }

  const issues = await listGithub<Issue>('/issues?state=all');
  const issue = issues
    .filter((item) => !item.pull_request && isMonitorPost(item) && item.body?.includes(issueMarker))
    .sort((a, b) => a.number - b.number)[0];
  const comments = issue ? await listGithub<Post>(`/issues/${issue.number}/comments`) : [];
  const reported = [issue?.body || '', ...comments.filter(isMonitorPost).map((comment) => comment.body || '')].join(
    '\n'
  );
  const unreported = releases.filter((release) => !reported.includes(releaseMarker(release)));
  if (!unreported.length) {
    console.info('All detected type-package releases have already been reported.');
    return;
  }

  const body = notificationBody(unreported);
  if (!issue) {
    const created = await githubRequest<Issue>('/issues', 'POST', {
      title: 'Investigate browser AI type package updates',
      body: `${issueMarker}\n\n${body}`,
      assignees: [assignee]
    });
    console.info(`Created investigation issue #${created.number} for ${unreported.length} release(s).`);
    return;
  }

  if (issue.state === 'closed' || !issue.assignees?.some((user) => user.login === assignee)) {
    await githubRequest(`/issues/${issue.number}`, 'PATCH', {
      state: 'open',
      assignees: [...new Set([...(issue.assignees || []).map((user) => user.login), assignee])]
    });
  }
  await githubRequest(`/issues/${issue.number}/comments`, 'POST', { body });
  console.info(`Added ${unreported.length} new release(s) to investigation issue #${issue.number}.`);
}

await checkTypeUpdates();
