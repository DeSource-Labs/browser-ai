export type SocialMediaKey = 'email' | 'telegram' | 'x' | 'linkedin' | 'github';

export type SocialMediaItem = {
  type: SocialMediaKey;
  href: string;
};

export type SocialMedia = Record<SocialMediaKey, string>;

export type Library = 'vue' | 'nuxt' | 'react' | 'typescript';

export type LibItem = {
  id: Library;
  name: string;
};

export type Tool = 'prompt-api' | 'summarizer' | 'writer' | 'rewriter' | 'translator' | 'language-detector' | 'proofreader';

export type ToolItem = {
  id: Tool;
  name: string;
  description: string;
};
