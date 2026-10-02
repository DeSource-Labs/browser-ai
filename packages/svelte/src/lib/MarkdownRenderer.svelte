<script lang="ts">
  import MarkdownIt from 'markdown-it';

  export let content: string;
  const markdown = new MarkdownIt({ breaks: true, html: false, linkify: true });
  $: rendered = markdown.render(content);
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- MarkdownIt escapes raw HTML and rejects unsafe link protocols. -->
<div class="browser-ai-markdown">{@html rendered}</div>
