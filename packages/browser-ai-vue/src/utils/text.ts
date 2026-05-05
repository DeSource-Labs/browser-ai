export interface TextSegment {
  text: string;
  start: number;
  end: number;
}

export interface TextChunk extends TextSegment {
  index: number;
}

const SENTENCE_BOUNDARY = /(?<=[.!?。！？])\s+/u;

export const normalizeTextInput = (value: string) => {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const stripHtmlForText = (value: string) => {
  if (!/<[a-z][\s\S]*>/i.test(value)) {
    return normalizeTextInput(value);
  }

  if (typeof document === 'undefined') {
    return normalizeTextInput(value.replace(/<[^>]+>/g, ' '));
  }

  const container = document.createElement('div');
  container.innerHTML = value;
  return normalizeTextInput(container.innerText || container.textContent || '');
};

export const normalizeSummaryInput = normalizeTextInput;
export const stripHtmlForSummary = stripHtmlForText;

export const splitTextIntoSegments = (value: string): TextSegment[] => {
  const input = normalizeTextInput(value);
  if (!input) return [];

  const segments: TextSegment[] = [];
  let cursor = 0;

  const pushSegment = (text: string, searchStart: number) => {
    const trimmed = text.trim();
    if (!trimmed) return searchStart + text.length;

    const localStart = text.indexOf(trimmed);
    const start = searchStart + Math.max(localStart, 0);
    const end = start + trimmed.length;
    segments.push({ text: trimmed, start, end });
    return searchStart + text.length;
  };

  input.split(/\n{2,}/).forEach((paragraph) => {
    const paragraphStart = input.indexOf(paragraph, cursor);
    cursor = paragraphStart < 0 ? cursor : paragraphStart;

    if (paragraph.length <= 1200) {
      cursor = pushSegment(paragraph, cursor);
      return;
    }

    paragraph.split(SENTENCE_BOUNDARY).forEach((sentence) => {
      cursor = pushSegment(sentence, cursor);
    });
  });

  return segments.length > 0 ? segments : [{ text: input, start: 0, end: input.length }];
};

export const createTextChunk = (text: string, index: number, start = 0): TextChunk => ({
  text: text.trim(),
  index,
  start,
  end: start + text.trim().length
});
