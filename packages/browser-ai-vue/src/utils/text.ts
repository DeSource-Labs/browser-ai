export interface TextSegment {
  text: string;
  start: number;
  end: number;
}

export interface TextChunk extends TextSegment {
  index: number;
}

const SENTENCE_BOUNDARY = /(?<=[.!?。！？])\s+/u;

export const normalizeSummaryInput = (value: string) => {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const stripHtmlForSummary = (value: string) => {
  if (!/<[a-z][\s\S]*>/i.test(value)) {
    return normalizeSummaryInput(value);
  }

  if (typeof document === 'undefined') {
    return normalizeSummaryInput(value.replace(/<[^>]+>/g, ' '));
  }

  const container = document.createElement('div');
  container.innerHTML = value;
  return normalizeSummaryInput(container.innerText || container.textContent || '');
};

export const splitTextIntoSegments = (value: string): TextSegment[] => {
  const input = normalizeSummaryInput(value);
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
