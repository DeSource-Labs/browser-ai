import MarkdownIt from "markdown-it";

let markdown: MarkdownIt | undefined;

const createMarkdownRenderer = () => {
  const renderer = new MarkdownIt({
    breaks: true,
    html: false,
    linkify: true,
    typographer: false,
  });

  const defaultLinkRenderer =
    renderer.renderer.rules.link_open ??
    ((tokens, index, options, _environment, tokenRenderer) =>
      tokenRenderer.renderToken(tokens, index, options));

  renderer.renderer.rules.link_open = (
    tokens,
    index,
    options,
    environment,
    tokenRenderer,
  ) => {
    const token = tokens[index];
    const href = token?.attrGet("href") ?? "";

    if (/^https?:\/\//i.test(href)) {
      token?.attrSet("target", "_blank");
      token?.attrSet("rel", "noopener noreferrer");
    }

    return defaultLinkRenderer(
      tokens,
      index,
      options,
      environment,
      tokenRenderer,
    );
  };

  return renderer;
};

export const renderMarkdown = (content: string) => {
  markdown ??= createMarkdownRenderer();
  return markdown.render(content);
};
