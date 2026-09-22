import type { Mock } from 'vitest';

export interface ContractAttachment {
  id: string;
  name: string;
  type: string;
  file?: File;
  url?: string;
}

export interface ContractMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  attachments?: ContractAttachment[];
}

export interface ContractChat {
  id: string;
  title: string;
  updatedAt: number;
  preview?: string;
}

export interface ContractActions {
  click(element: Element): Promise<void>;
  flush(): Promise<void>;
  keyDown(element: Element, init: KeyboardEventInit): Promise<KeyboardEvent>;
  selectFiles(input: HTMLInputElement, files: File[]): Promise<void>;
  setValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): Promise<void>;
}

export interface ContractRender {
  container: HTMLElement;
  actions: ContractActions;
  cleanup(): void | Promise<void>;
}

export interface CallbackSet {
  [name: string]: Mock;
}
