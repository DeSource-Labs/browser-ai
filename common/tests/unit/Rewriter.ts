import { testTextTool, type TextToolSetup } from './_textTool';

export function testRewriter(setup: TextToolSetup): void {
  testTextTool(setup, {
    action: 'Rewrite',
    emptyOutput: 'Rewritten text will appear here.',
    globalName: 'Rewriter',
    method: 'rewriteStreaming',
    output: 'Clear rewrite',
    outputText: 'Clear rewrite',
    title: 'Rewriter'
  });
}
