import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/utils/markdown';

describe('renderMarkdown', () => {
  it('renders common LLM Markdown output', () => {
    const html = renderMarkdown('## Result\n\n- **Fast**\n- `typed`\n\n```ts\nconst local = true\n```');

    expect(html).toContain('<h2>Result</h2>');
    expect(html).toContain('<strong>Fast</strong>');
    expect(html).toContain('<code class="language-ts">');
  });

  it('escapes raw HTML and rejects unsafe links', () => {
    const html = renderMarkdown('<script>alert("x")</script> [unsafe](javascript:alert(1))');

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });

  it('secures external links', () => {
    const html = renderMarkdown('[Documentation](https://example.com/docs)');

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
