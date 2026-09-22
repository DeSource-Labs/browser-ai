import { testTextTool, type TextToolSetup } from './_textTool';

export function testWriter(setup: TextToolSetup): void {
  testTextTool(setup, {
    action: 'Write',
    emptyOutput: 'Generated draft will appear here.',
    globalName: 'Writer',
    method: 'writeStreaming',
    output: 'Generated draft',
    outputText: 'Generated draft',
    title: 'Writer'
  });
}
