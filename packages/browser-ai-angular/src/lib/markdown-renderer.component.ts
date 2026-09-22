import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import MarkdownIt, { type MarkdownIt as MarkdownItInstance } from 'markdown-it';

let markdown: MarkdownItInstance | undefined;

@Component({
  selector: 'browser-ai-markdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div class="browser-ai-markdown" [innerHTML]="rendered()"></div>'
})
export class BrowserAiMarkdownRendererComponent {
  readonly content = input('');
  readonly rendered = computed(() => {
    markdown ??= new MarkdownIt({ breaks: true, html: false, linkify: true });
    return markdown.render(this.content());
  });
}
