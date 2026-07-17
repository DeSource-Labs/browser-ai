export type SocialMediaKey = "email" | "telegram" | "x" | "linkedin" | "github";

export type SocialMediaItem = {
  type: SocialMediaKey;
  href: string;
};

export type SocialMedia = Record<SocialMediaKey, string>;

export type Library =
  "vue" | "nuxt" | "react" | "angular" | "svelte" | "typescript";

export type LibItem = {
  id: Library;
  name: string;
  status: "available" | "planned";
  description: string;
};

export type Tool =
  | "prompt-api"
  | "summarizer"
  | "writer"
  | "rewriter"
  | "translator"
  | "language-detector"
  | "proofreader"
  | "webmcp";

export type ToolItem = {
  id: Tool;
  name: string;
  description: string;
  href: string;
  openable?: boolean;
};
