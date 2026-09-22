export type SocialMediaKey = 'email' | 'telegram' | 'x' | 'linkedin' | 'github';

export type SocialMediaItem = {
  type: SocialMediaKey;
  href: string;
};

export type SocialMedia = Record<SocialMediaKey, string>;

export type Library = 'vue' | 'nuxt' | 'react' | 'angular' | 'svelte' | 'typescript';

export type LibItem = {
  id: Library;
  name: string;
  status: 'available';
  description: string;
};

export type Tool =
  'prompt-api' | 'summarizer' | 'writer' | 'rewriter' | 'translator' | 'language-detector' | 'proofreader' | 'webmcp';

export type ToolItem = {
  id: Tool;
  name: string;
  description: string;
  href: string;
  openable?: boolean;
};

export type ApiUsageExample = {
  label: string;
  title: string;
  description: string;
  code: string;
};

export type ApiGuide = {
  id: Tool;
  title: string;
  description: string;
  eyebrow: string;
  workspace: 'chat' | 'tool' | 'webmcp';
  mobileWorkspaceHeight?: number;
  examples: ApiUsageExample[];
};
