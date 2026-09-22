import { describe, expect, it } from 'vitest';
import type { Mock } from 'vitest';
import type { ContractChat, ContractRender } from './types';

export interface ChatSidebarResult extends ContractRender {
  onCreate: Mock;
  onDelete: Mock;
  onRename: Mock;
  onSelect: Mock;
}

export type ChatSidebarSetup = (options?: {
  chats?: ContractChat[];
  activeChatId?: string | null;
  disabled?: boolean;
}) => ChatSidebarResult | Promise<ChatSidebarResult>;

export function testChatSidebar(setup: ChatSidebarSetup): void {
  describe('ChatSidebar shared contract', () => {
    it('uses shared structure and routes create, select, rename, and delete actions', async () => {
      const rendered = await setup({
        chats: [{ id: 'chat-1', title: 'Planning', preview: 'A private plan', updatedAt: 1 }],
        activeChatId: 'chat-1'
      });
      const sidebar = rendered.container.querySelector('.chat-sidebar');
      expect(sidebar?.getAttribute('aria-label')).toBe('Saved conversations');
      expect(rendered.container.querySelector('.chat-sidebar__list')).not.toBeNull();
      expect(rendered.container.querySelector('.chat-sidebar__item')).not.toBeNull();
      expect(
        rendered.container.querySelector('.chat-sidebar__item.is-active, .chat-sidebar__item--active')
      ).not.toBeNull();

      await rendered.actions.click(rendered.container.querySelector('[data-browser-ai-action="create"]')!);
      await rendered.actions.click(rendered.container.querySelector('[data-browser-ai-action="select"]')!);
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Rename Planning"]')!);
      const rename = rendered.container.querySelector('.chat-sidebar__rename input') as HTMLInputElement;
      await rendered.actions.setValue(rename, '  Roadmap  ');
      await rendered.actions.click(rendered.container.querySelector('[data-browser-ai-action="save-rename"]')!);
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Delete Planning"]')!);

      expect(rendered.onCreate).toHaveBeenCalledOnce();
      expect(rendered.onSelect).toHaveBeenCalledWith('chat-1');
      expect(rendered.onRename).toHaveBeenCalledWith('chat-1', 'Roadmap');
      expect(rendered.onDelete).toHaveBeenCalledWith('chat-1');
      await rendered.cleanup();
    });

    it('disables every mutating action', async () => {
      const rendered = await setup({
        chats: [{ id: 'chat-1', title: 'Planning', updatedAt: 1 }],
        activeChatId: null,
        disabled: true
      });
      const buttons = [...rendered.container.querySelectorAll('button')];
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((button) => button.disabled)).toBe(true);
      await rendered.cleanup();
    });

    it('rejects blank renames and supports cancellation', async () => {
      const rendered = await setup({
        chats: [{ id: 'chat-1', title: 'Planning', updatedAt: 1 }],
        activeChatId: null
      });
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Rename Planning"]')!);
      const form = rendered.container.querySelector('.chat-sidebar__rename')!;
      const rename = form.querySelector('input')!;
      await rendered.actions.setValue(rename, '   ');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await rendered.actions.flush();
      expect(rendered.onRename).not.toHaveBeenCalled();
      await rendered.actions.click(rendered.container.querySelector('[data-browser-ai-action="cancel-rename"]')!);
      expect(rendered.container.querySelector('.chat-sidebar__rename')).toBeNull();
      await rendered.cleanup();
    });
  });
}
