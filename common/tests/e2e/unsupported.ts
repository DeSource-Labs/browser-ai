import { expect, test } from '@playwright/test';

export const PUBLIC_COMPONENTS = [
  'ChatHistory',
  'ChatSidebar',
  'LanguageDetector',
  'MarkdownRenderer',
  'PromptApi',
  'PromptInput',
  'Proofreader',
  'Rewriter',
  'Summarizer',
  'Translator',
  'Writer'
] as const;

export function testUnsupportedBrowserDemo(framework: string) {
  test.describe(`${framework} demo in unsupported Chromium`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('framework')).toHaveText(framework);
    });

    test('renders every public component from the shared contract', async ({ page }) => {
      for (const component of PUBLIC_COMPONENTS) {
        await expect(page.locator(`[data-component="${component}"]`)).toHaveCount(1);
      }
    });

    test('reports every unavailable browser API without crashing', async ({ page }) => {
      const capabilities = page.getByTestId('api-capabilities');
      await expect(capabilities.locator('.demo-capability')).toHaveCount(8);
      await expect(capabilities).toContainText('LanguageModel');
      await expect(capabilities).toContainText('unavailable');
      await expect(capabilities).toContainText('WebMCP');
      await expect(capabilities).toContainText('unsupported');
      await expect(page.getByTestId('webmcp-support')).not.toHaveText('supported');
      await expect(page.getByTestId('register-webmcp')).toBeDisabled();
    });

    test('returns a useful Prompt API error and keeps the UI interactive', async ({ page }) => {
      const prompt = page.locator('[data-component="PromptApi"]');
      await prompt.locator('textarea').fill('Reply with READY.');
      await prompt.getByRole('button', { name: 'Send prompt' }).click();
      await expect(prompt.locator('.chat-message--assistant')).toContainText(
        /unavailable|not available|not ready|browser ai/i
      );

      const form = page.getByTestId('webmcp-form');
      await form.locator('input[name="title"]').fill('Created without WebMCP');
      await form.getByRole('button', { name: 'Add task' }).click();
      await expect(page.getByTestId('task-list')).toContainText('Created without WebMCP');
    });
  });
}
