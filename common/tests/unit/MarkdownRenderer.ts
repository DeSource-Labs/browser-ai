import { describe, expect, it } from 'vitest';
import type { ContractRender } from './types';

export type MarkdownRendererSetup = (content: string) => ContractRender | Promise<ContractRender>;

export function testMarkdownRenderer(setup: MarkdownRendererSetup): void {
  describe('MarkdownRenderer shared contract', () => {
    it('uses the shared root and renders safe Markdown with links', async () => {
      const rendered = await setup('## Result\n\n**Local** [docs](https://example.com) <script>unsafe()</script>');
      const root = rendered.container.querySelector('.browser-ai-markdown');
      expect(root).not.toBeNull();
      expect(root?.querySelector('h2')?.textContent).toBe('Result');
      expect(root?.querySelector('strong')?.textContent).toBe('Local');
      expect(root?.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
      expect(root?.querySelector('script')).toBeNull();
      expect(root?.textContent).toContain('<script>unsafe()</script>');
      await rendered.cleanup();
    });
  });
}
