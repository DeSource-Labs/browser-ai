import { describe, expect, it } from 'vitest';
import type { ContractMessage, ContractRender } from './types';

export interface ChatHistoryOptions {
  messages: ContractMessage[];
  isTyping?: boolean;
  autoScroll?: boolean;
}
export type ChatHistorySetup = (
  options: ChatHistoryOptions
) =>
  | (ContractRender & { update(options: Partial<ChatHistoryOptions>): Promise<void> })
  | Promise<ContractRender & { update(options: Partial<ChatHistoryOptions>): Promise<void> }>;

export function testChatHistory(setup: ChatHistorySetup): void {
  describe('ChatHistory shared contract', () => {
    it('renders the common accessible empty state', async () => {
      const rendered = await setup({ messages: [] });
      expect(rendered.container.querySelector('.chat-history-shell')).not.toBeNull();
      const history = rendered.container.querySelector('.chat-history');
      expect(history?.getAttribute('role')).toBe('log');
      expect(history?.getAttribute('aria-live')).toBe('polite');
      expect(rendered.container.querySelector('.chat-history__empty')?.textContent).toContain('on-device');
      await rendered.cleanup();
    });

    it('renders roles, safe Markdown, attachments, and generation status', async () => {
      const rendered = await setup({
        messages: [
          {
            id: 'user-1',
            role: 'user',
            content: '**Inspect these** <script>unsafe()</script>',
            attachments: [
              { id: 'image-1', name: 'diagram.png', type: 'image/png', url: 'blob:diagram' },
              { id: 'file-1', name: 'notes.txt', type: 'text/plain', url: 'blob:notes' }
            ]
          },
          { id: 'assistant-1', role: 'assistant', content: 'Ready.' }
        ],
        isTyping: true
      });

      expect(rendered.container.querySelectorAll('.chat-message')).toHaveLength(2);
      expect(rendered.container.querySelectorAll('.chat-message__role')[0]?.textContent).toContain('You');
      expect(rendered.container.querySelectorAll('.chat-message__role')[1]?.textContent).toContain('Local AI');
      expect(rendered.container.querySelectorAll('time[datetime]')).toHaveLength(2);
      expect(rendered.container.querySelector('.chat-message--user')).not.toBeNull();
      expect(rendered.container.querySelector('.chat-message--assistant')).not.toBeNull();
      expect(rendered.container.querySelector('.browser-ai-markdown strong')?.textContent).toBe('Inspect these');
      expect(rendered.container.querySelector('.browser-ai-markdown script')).toBeNull();
      expect(rendered.container.querySelector('img[alt="diagram.png"]')).not.toBeNull();
      expect(rendered.container.textContent).toContain('notes.txt');
      expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('Generating locally');
      await rendered.cleanup();
    });

    it('preserves the reading position during streaming and jumps on request', async () => {
      const message: ContractMessage = { id: 'stream', role: 'assistant', content: 'First' };
      const rendered = await setup({ messages: [message] });
      const history = rendered.container.querySelector<HTMLElement>('.chat-history')!;
      Object.defineProperties(history, {
        scrollHeight: { value: 1000, configurable: true },
        clientHeight: { value: 200, configurable: true }
      });
      history.scrollTop = 100;
      history.dispatchEvent(new Event('scroll'));
      await rendered.actions.flush();
      await rendered.update({ messages: [{ ...message, content: 'First second' }] });
      expect(history.scrollTop).toBe(100);
      const jump = rendered.container.querySelector<HTMLButtonElement>('.chat-history__latest')!;
      expect(jump).not.toBeNull();
      await rendered.actions.click(jump);
      await rendered.actions.flush();
      expect(history.scrollTop).toBe(1000);
      expect(rendered.container.querySelector('.chat-history__latest')).toBeNull();
      await rendered.update({ autoScroll: false });
      history.scrollTop = 100;
      await rendered.update({ messages: [{ ...message, content: 'New content' }] });
      expect(history.scrollTop).toBe(100);
      await rendered.update({ autoScroll: true });
      expect(history.scrollTop).toBe(1000);
      await rendered.cleanup();
    });
  });
}
