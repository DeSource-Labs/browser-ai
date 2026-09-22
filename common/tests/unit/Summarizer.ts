import { testTextTool, type TextToolSetup } from './_textTool';

export function testSummarizer(setup: TextToolSetup): void {
  testTextTool(setup, {
    action: 'Summarize',
    emptyOutput: 'Summary output will appear here.',
    globalName: 'Summarizer',
    method: 'summarize',
    output: 'Short summary',
    outputText: 'Short summary',
    title: 'Summarizer'
  });
}
