import { describe, expect, it, vi, type Mock } from 'vitest';
import type { ContractAttachment, ContractRender } from './types';

export interface PromptInputOptions {
  value?: string;
  attachments?: ContractAttachment[];
  disabled?: boolean;
  busy?: boolean;
  sendOnEnter?: boolean;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  maxAttachments?: number;
}

export interface PromptInputResult extends ContractRender {
  onAttachmentsChange: Mock;
  onSend: Mock;
  onValueChange: Mock;
  onVoice: Mock;
}

export type PromptInputSetup = (options?: PromptInputOptions) => PromptInputResult | Promise<PromptInputResult>;

export function testPromptInput(setup: PromptInputSetup): void {
  describe('PromptInput shared contract', () => {
    it('uses shared structure and controlled text/send semantics', async () => {
      const rendered = await setup({ value: '', allowVoice: true });
      expect(rendered.container.querySelector('.prompt-input > .prompt-input__row')).not.toBeNull();
      const textarea = rendered.container.querySelector('.prompt-input__field') as HTMLTextAreaElement;
      await rendered.actions.setValue(textarea, 'Hello model');
      expect(rendered.onValueChange).toHaveBeenLastCalledWith('Hello model');

      const shifted = await rendered.actions.keyDown(textarea, { key: 'Enter', shiftKey: true });
      expect(shifted.defaultPrevented).toBe(false);
      expect(rendered.onSend).not.toHaveBeenCalled();
      const composing = await rendered.actions.keyDown(textarea, { key: 'Enter', isComposing: true });
      expect(composing.defaultPrevented).toBe(false);
      expect(rendered.onSend).not.toHaveBeenCalled();
      const enter = await rendered.actions.keyDown(textarea, { key: 'Enter' });
      expect(enter.defaultPrevented).toBe(true);
      expect(rendered.onSend).toHaveBeenCalledOnce();
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Start voice input"]')!);
      expect(rendered.onVoice).toHaveBeenCalledOnce();
      await rendered.cleanup();
    });

    it('supports image/file attachments, limits, removal, and owned URL cleanup', async () => {
      let sequence = 0;
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(() => `blob:shared-${++sequence}`),
        configurable: true
      });
      Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
      const rendered = await setup({ allowAttachments: true, maxAttachments: 1 });
      const picker = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(picker).not.toBeNull();
      await rendered.actions.selectFiles(picker, [
        new File(['image'], 'diagram.png', { type: 'image/png' }),
        new File(['text'], 'notes.txt', { type: 'text/plain' })
      ]);
      expect(rendered.onAttachmentsChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'diagram.png', type: 'image/png' })
      ]);
      expect(rendered.container.querySelector('img[alt="diagram.png"]')).not.toBeNull();
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Remove diagram.png"]')!);
      expect(rendered.onAttachmentsChange).toHaveBeenLastCalledWith([]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:shared-1');
      await rendered.cleanup();
    });

    it('blocks disabled, busy, and sendOnEnter=false paths', async () => {
      const rendered = await setup({
        value: 'Ready',
        disabled: true,
        busy: true,
        sendOnEnter: false,
        allowVoice: true
      });
      const textarea = rendered.container.querySelector('textarea')!;
      await rendered.actions.keyDown(textarea, { key: 'Enter' });
      await rendered.actions.click(rendered.container.querySelector('.prompt-input__send')!);
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Start voice input"]')!);
      expect(rendered.onSend).not.toHaveBeenCalled();
      expect(rendered.onVoice).not.toHaveBeenCalled();
      expect((rendered.container.querySelector('.prompt-input__send') as HTMLButtonElement).disabled).toBe(true);
      await rendered.cleanup();
    });

    it('honors a zero attachment limit and never revokes caller-owned URLs', async () => {
      Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:unexpected'), configurable: true });
      Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
      const rendered = await setup({
        allowAttachments: true,
        maxAttachments: 0,
        attachments: [{ id: 'external', name: 'external.txt', type: 'text/plain', url: 'blob:external' }]
      });
      const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
      await rendered.actions.selectFiles(input, [new File(['new'], 'new.txt', { type: 'text/plain' })]);
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Remove external.txt"]')!);
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:external');
      await rendered.cleanup();
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:external');
    });
  });
}
