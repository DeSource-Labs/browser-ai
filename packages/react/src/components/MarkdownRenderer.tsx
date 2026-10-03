import MarkdownIt from 'markdown-it';
import { useMemo } from 'react';

export interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const markdown = useMemo(() => new MarkdownIt({ breaks: true, html: false, linkify: true }), []);
  const rendered = useMemo(() => markdown.render(content), [content, markdown]);
  return <div className="browser-ai-markdown" dangerouslySetInnerHTML={{ __html: rendered }} />;
}
