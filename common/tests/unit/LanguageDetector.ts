import { testTextTool, type TextToolSetup } from './_textTool';

export function testLanguageDetector(setup: TextToolSetup): void {
  testTextTool(setup, {
    action: 'Detect',
    emptyOutput: 'Language results will appear here.',
    globalName: 'LanguageDetector',
    method: 'detect',
    output: [{ detectedLanguage: 'en', confidence: 0.98 }],
    outputText: 'en',
    title: 'LanguageDetector'
  });
}
