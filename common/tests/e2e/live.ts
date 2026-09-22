import { chromium, expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const imageFixture = fileURLToPath(new URL('../../../demo/public/logo/favicon-32x32.png', import.meta.url));

const outputFor = (page: Page, component: string) =>
  page.locator(`[data-component="${component}"] .writing-tool__output`);

async function runTextTool(page: Page, component: string, input: string, placeholder: RegExp) {
  const root = page.locator(`[data-component="${component}"]`);
  const output = outputFor(page, component);
  await root.locator('textarea').first().fill(input);
  await root.locator('[data-browser-ai-action="run"]').click();
  await expect(output).not.toContainText(placeholder, { timeout: 180_000 });
  await expect(output).not.toBeEmpty();
}

async function capabilityStatus(page: Page, name: string) {
  const capability = page.locator('.demo-capability').filter({ has: page.getByText(name, { exact: true }) });
  await expect(capability).toHaveCount(1);
  return (await capability.locator('strong').textContent())?.trim();
}

export function testEnabledChromeDemo(framework: string, baseURL: string) {
  test(`${framework} @live uses the enabled user Chrome for every AI adapter and WebMCP`, async () => {
    test.setTimeout(15 * 60_000);
    const endpoint = process.env.BROWSER_AI_CDP_ENDPOINT;
    test.skip(
      !endpoint,
      'Set BROWSER_AI_CDP_ENDPOINT to the enabled Chrome DevTools endpoint (for example http://127.0.0.1:9222).'
    );

    const browser = await chromium.connectOverCDP(endpoint!, { isLocal: true, noDefaults: true });
    const context = browser.contexts()[0];
    expect(context, 'The CDP browser must expose its default context.').toBeTruthy();
    const page = await context.newPage();

    try {
      await page.goto(baseURL);
      await expect(page.getByTestId('framework')).toHaveText(framework);
      const capabilities = page.getByTestId('api-capabilities');
      await expect(capabilities.locator('.demo-capability')).toHaveCount(8);
      for (const name of ['LanguageModel', 'Summarizer', 'Writer', 'Rewriter', 'LanguageDetector', 'Proofreader']) {
        expect(await capabilityStatus(page, name)).toBe('available');
      }
      const translatorStatus = await capabilityStatus(page, 'Translator');
      expect(await capabilityStatus(page, 'WebMCP')).toBe('supported');

      const prompt = page.locator('[data-component="PromptApi"]');
      await prompt.locator('textarea').fill('Reply with exactly READY.');
      await prompt.getByRole('button', { name: 'Send prompt' }).click();
      await expect(prompt.locator('.chat-message--assistant').last()).toContainText(/READY/i, { timeout: 180_000 });

      const imageAvailability = await page.evaluate(() =>
        LanguageModel.availability({
          expectedInputs: [{ type: 'text' }, { type: 'image' }],
          expectedOutputs: [{ type: 'text' }]
        })
      );
      const imageInput = prompt.locator('input[type="file"]');
      await imageInput.setInputFiles(imageFixture);
      await expect(prompt.locator('.prompt-input__attachment')).toContainText('favicon-32x32.png');
      if (imageAvailability === 'available') {
        const assistantCount = await prompt.locator('.chat-message--assistant').count();
        await prompt.locator('textarea').fill('Inspect the attached image, then reply with exactly IMAGE READY.');
        await prompt.getByRole('button', { name: 'Send prompt' }).click();
        await expect(prompt.locator('.chat-message--assistant')).toHaveCount(assistantCount + 1);
        await expect(prompt.locator('.chat-message--assistant').last()).toContainText(/IMAGE READY/i, {
          timeout: 180_000
        });
      } else {
        expect(['downloadable', 'downloading', 'unavailable']).toContain(imageAvailability);
        await prompt.getByRole('button', { name: 'Remove favicon-32x32.png' }).click();
      }

      await runTextTool(
        page,
        'Summarizer',
        'Browser AI runs local models. Local inference keeps private drafts on the device. Summarize this.',
        /summary output will appear/i
      );
      await runTextTool(
        page,
        'Writer',
        'Write one short sentence about private browser AI.',
        /generated draft will appear/i
      );
      await runTextTool(page, 'Rewriter', 'Browser AI is useful and fast.', /rewritten text will appear/i);
      if (translatorStatus === 'available' || process.env.BROWSER_AI_ALLOW_MODEL_DOWNLOADS === '1') {
        await runTextTool(page, 'Translator', 'Hello from the browser.', /translation will appear/i);
      } else {
        expect(['downloadable', 'downloading']).toContain(translatorStatus);
        await expect(page.locator('[data-component="Translator"] [data-browser-ai-action="run"]')).toContainText(
          /download/i
        );
      }
      await runTextTool(page, 'LanguageDetector', 'Bonjour tout le monde.', /language results will appear/i);
      await runTextTool(page, 'Proofreader', 'This sentence have one mistake.', /corrected output will appear/i);

      await expect(page.getByTestId('webmcp-support')).toHaveText('supported');
      await page.getByTestId('register-webmcp').click();
      await expect(page.getByTestId('register-webmcp')).toHaveText('Tool registered');

      await page.getByTestId('execute-webmcp').click();
      await expect(page.getByTestId('task-list')).toContainText('Created through WebMCP');
    } finally {
      await page.close();
      // Never call browser.close(): this is the user's existing Chrome process.
    }
  });
}
