import { testTextTool, type TextToolSetup } from './_textTool';

export function testProofreader(setup: TextToolSetup): void {
  testTextTool(setup, {
    action: 'Proofread',
    emptyOutput: 'Corrected output will appear here.',
    globalName: 'Proofreader',
    method: 'proofread',
    output: { correctedInput: 'Correct text.', corrections: [] },
    outputText: 'Correct text.',
    title: 'Proofreader'
  });
}
