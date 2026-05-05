export interface TextSegment {
  text: string;
  start: number;
  end: number;
}

export interface TextChunk extends TextSegment {
  index: number;
}

export interface BuildMeasuredTextChunksOptions {
  input: string;
  budget: number;
  measure: (input: string) => Promise<number>;
  startIndex?: number;
  onProgress?: (chunks: TextChunk[]) => void;
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

export const joinTextBlocks = (current: string, next: string) => {
  return current ? `${current}\n\n${next}` : next;
};

const splitOversizedTextSegment = async (
  segment: TextSegment,
  budget: number,
  measure: (input: string) => Promise<number>,
  startIndex: number
) => {
  const chunks: TextChunk[] = [];
  let remaining = segment.text;
  let absoluteStart = segment.start;
  let index = startIndex;

  while (remaining.trim()) {
    let low = 1;
    let high = remaining.length;
    let best = 0;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = remaining.slice(0, middle).trim();
      const usage = await measure(candidate);
      if (usage <= budget) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    if (best <= 0) {
      best = Math.min(remaining.length, 1200);
    }

    const whitespace = remaining.lastIndexOf(' ', best);
    const sliceEnd = whitespace > 240 ? whitespace : best;
    const text = remaining.slice(0, sliceEnd).trim();
    chunks.push(createTextChunk(text, index, absoluteStart));

    absoluteStart += sliceEnd;
    remaining = remaining.slice(sliceEnd).trim();
    index += 1;
  }

  return chunks;
};

export const buildMeasuredTextChunks = async ({
  input,
  budget,
  measure,
  startIndex = 0,
  onProgress
}: BuildMeasuredTextChunksOptions) => {
  const segments = splitTextIntoSegments(input);
  const chunks: TextChunk[] = [];
  let current = '';
  let currentStart = segments[0]?.start ?? 0;

  for (const segment of segments) {
    const candidate = joinTextBlocks(current, segment.text);
    const usage = await measure(candidate);

    if (usage <= budget) {
      if (!current) {
        currentStart = segment.start;
      }
      current = candidate;
    } else if (!current) {
      const split = await splitOversizedTextSegment(
        segment,
        budget,
        measure,
        startIndex + chunks.length
      );
      chunks.push(...split);
    } else {
      chunks.push(createTextChunk(current, startIndex + chunks.length, currentStart));
      current = segment.text;
      currentStart = segment.start;
    }

    onProgress?.(chunks);
  }

  if (current.trim()) {
    chunks.push(createTextChunk(current, startIndex + chunks.length, currentStart));
  }

  return chunks;
};
