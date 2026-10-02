export interface ChatAttachment {
  id: string;
  file?: File;
  url?: string;
  name: string;
  type: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  attachments?: ChatAttachment[];
}

export interface ChatSidebarItem {
  id: string;
  title: string;
  updatedAt: number;
  preview?: string;
}
