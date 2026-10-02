# Contributing to Browser AI Kit

Help make private, on-device AI easier to build into web apps. Bug reports, browser compatibility findings, documentation improvements, tests, and framework contributions are welcome.

Use [GitHub Discussions](https://github.com/DeSource-Labs/browser-ai/discussions) for integration questions. For bugs, include a minimal reproduction, package and framework versions, Chrome version, operating system, availability state, and relevant flags. Discuss substantial public API changes in an issue before implementing them.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Development setup

Use Node.js 26 and pnpm 12.8.1, as pinned in `package.json`. The supported Node.js ranges are listed in that file's `engines` field.

```sh
git clone https://github.com/DeSource-Labs/browser-ai.git
cd browser-ai
pnpm install --frozen-lockfile
pnpm build
pnpm dev:prepare
pnpm dev:demo
```

The Nuxt demo runs at `http://localhost:3000`. Open it in Chrome to try the local models, or in another browser to check the unavailable state. See [Browser setup](docs/browser-support.md#try-it-in-your-browser) for models and downloads. For a focused framework demo:

```sh
pnpm --filter @desource/browser-ai-vue dev
pnpm --filter @desource/browser-ai-react dev
pnpm --filter @desource/browser-ai-svelte dev
pnpm --filter @desource/browser-ai-angular dev
```

## Repository structure

| Path                                             | Contents                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `packages/core`                                  | Native controllers, workflows, chat storage, and conversation state |
| `packages/browser-ai-{vue,react,svelte,angular}` | Framework bindings, components, tests, and demos                    |
| `packages/browser-ai-nuxt`                       | Nuxt registration and auto-imports                                  |
| `common/styles`                                  | Shared component styles                                             |
| `common/tests`                                   | Shared component contracts and browser scenarios                    |
| `demo`                                           | Nuxt documentation site and interactive examples                    |
| `scripts`                                        | Coverage, release, parity, bundle, and type-update tooling          |

Keep browser and model behavior in core. Framework packages own rendering, subscriptions, and lifecycle cleanup. Shared component behavior belongs in `common/tests/unit`; framework-specific tests belong in the owning package. Preserve server imports without browser globals and dispose sessions with their owner.

Keep model processing local. The library must not add an inference proxy or silently fall back to a hosted model. Treat availability, downloads, cancellation, context limits, and cleanup as part of the feature, and update the relevant tests when behavior changes.

## Quality checks

```sh
pnpm check:release
```

This runs formatting, lint, framework parity, peer checks, the production dependency audit, all package and demo builds, bundle checks, typechecks, package validation, and unit coverage. It excludes e2e tests, which run locally as described below. Maintainers can dispatch the CI workflow to run these checks on a branch.

For focused work, use `pnpm build`, `pnpm build:fixtures`, `pnpm build:demo`, `pnpm typecheck`, or `pnpm test:unit`. Build packages before running dependent package tests or the Nuxt demo.

Each package enforces a 95% minimum for statements, branches, functions, and lines. `pnpm test:unit:coverage` writes HTML and LCOV reports under each package's `coverage/` directory. LCOV source paths start at the repository root so Codecov can distinguish packages.

The Coverage workflow runs on pushes to `main`. Maintainers can dispatch it with a `pr_number` to compare a PR merge ref against its base commit and post a report, or with a `ref` to check a branch, tag, or SHA. A PR number takes precedence. Only pushes to `main` upload to Codecov. Configure `CODECOV_TOKEN` in repository secrets; `CODECOV_API_TOKEN` is optional for baseline lookup when local baseline reports are unavailable. PR code runs without write permissions or repository secrets; the reporting job uses scripts from `main`.

## Local browser tests

E2e tests run only on developer machines, including the Nuxt integration suite. GitHub workflows do not install Playwright browsers or invoke these suites.

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The default framework tests verify unsupported behavior in bundled Chromium. To exercise installed AI resources and WebMCP, use an existing Chrome profile with the required APIs enabled. Open `chrome://inspect/#remote-debugging`, enable remote debugging for that browser instance, and pass its local CDP endpoint:

```sh
BROWSER_AI_CDP_ENDPOINT=http://127.0.0.1:9222 pnpm test:e2e:live
```

Live tests open and close their own pages and reuse the profile. They skip when no endpoint is configured. Downloadable resources are checked without installation unless `BROWSER_AI_ALLOW_MODEL_DOWNLOADS=1` is set. Keep the debugging endpoint local. Record skipped APIs and the browser version when reporting results.

## Pull requests

Use Conventional Commits such as `fix:`, `feat:`, `docs:`, or `chore:`. Include the problem, resulting behavior, and checks run. Update affected package guides and examples when public behavior changes.

Add a changeset for changes to published packages:

```sh
pnpm changeset
```

Choose `patch` for fixes, `minor` for backward-compatible features, and `major` for breaking changes. All six public packages form one fixed release group. Select every package and use the same summary so versions and changelog entries stay aligned. Documentation-only changes and repository maintenance do not need a changeset.

## Releases

Maintainers prepare a release locally:

```sh
pnpm changeset:version
pnpm check:release
RELEASE_NOTES_PATH=/tmp/browser-ai-release-notes.md pnpm release:prepare
```

`changeset:version` updates versions, formats generated dependency notes, and refreshes the lockfile. `release:prepare` checks that all public versions and release notes match, allowing generated dependency-update entries to differ.

Commit the version, changelog, lockfile, and consumed changeset updates with `chore: Release packages` (lowercase `release` also works). A push to `main` with that message and package manifest or changelog changes triggers publishing. Maintainers can also dispatch Release manually for a prepared release commit.

The workflow checks the release, publishes with `changeset publish --no-git-tag`, then creates one `X.Y.Z` tag and GitHub release from the shared changelog entry. Configure `NPM_TOKEN` with package publishing access and `CODECOV_TOKEN` for coverage. The workflow uses `GITHUB_TOKEN` for its GitHub release. Package versions are changed locally, not by a release-PR bot.
