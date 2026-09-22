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
  if (!/<[a-z][\s\S]*>/i.test(value)) return normalizeTextInput(value);
  if (typeof document === 'undefined') {
    return normalizeTextInput(value.replace(/<[^>]+>/g, ' ').replace(/[ \t]{2,}/g, ' '));
  }

  const container = document.createElement('div');
  container.innerHTML = value;
  return normalizeTextInput(container.innerText || container.textContent || '');
};

export const splitTextIntoSegments = (value: string): TextSegment[] => {
  const input = normalizeTextInput(value);
  if (!input) return [];

  const segments: TextSegment[] = [];
  let cursor = 0;

  const pushSegment = (text: string, searchStart: number) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const found = input.indexOf(trimmed, searchStart);
    const start = found >= 0 ? found : searchStart + Math.max(text.indexOf(trimmed), 0);
    segments.push({ text: trimmed, start, end: start + trimmed.length });
  };

  input.split(/\n{2,}/).forEach((paragraph) => {
    const paragraphStart = input.indexOf(paragraph, cursor);
    const start = paragraphStart < 0 ? cursor : paragraphStart;

    if (paragraph.length <= 1200) {
      pushSegment(paragraph, start);
      cursor = start + paragraph.length;
      return;
    }

    let sentenceCursor = start;
    paragraph.split(SENTENCE_BOUNDARY).forEach((sentence) => {
      pushSegment(sentence, sentenceCursor);
      const found = input.indexOf(sentence.trim(), sentenceCursor);
      sentenceCursor = (found >= 0 ? found : sentenceCursor) + sentence.trim().length;
    });
    cursor = start + paragraph.length;
  });

  return segments.length > 0 ? segments : [{ text: input, start: 0, end: input.length }];
};

export const createTextChunk = (text: string, index: number, start = 0, end?: number): TextChunk => {
  const normalized = text.trim();
  const leadingWhitespace = normalized ? Math.max(text.indexOf(normalized), 0) : 0;
  const normalizedStart = start + leadingWhitespace;
  return {
    text: normalized,
    index,
    start: normalizedStart,
    end: end ?? normalizedStart + normalized.length
  };
};

export const joinTextBlocks = (current: string, next: string) => (current ? `${current}\n\n${next}` : next);

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
      const usage = await measure(remaining.slice(0, middle).trim());
      if (usage <= budget) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    if (best <= 0) best = Math.min(remaining.length, 1200);
    const whitespace = remaining.lastIndexOf(' ', best);
    const sliceEnd = whitespace > 240 ? whitespace : best;
    const text = remaining.slice(0, sliceEnd).trim();
    chunks.push(createTextChunk(text, index, absoluteStart));
    const tail = remaining.slice(sliceEnd);
    const trimmedTail = tail.trimStart();
    absoluteStart += sliceEnd + (tail.length - trimmedTail.length);
    remaining = trimmedTail.trimEnd();
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
  const normalizedInput = normalizeTextInput(input);
  const chunks: TextChunk[] = [];
  let current = '';
  let currentStart = segments[0]?.start ?? 0;
  let currentEnd = currentStart;

  for (const segment of segments) {
    const candidate = current ? normalizedInput.slice(currentStart, segment.end) : segment.text;
    const usage = await measure(candidate);

    if (usage <= budget) {
      if (!current) currentStart = segment.start;
      current = candidate;
      currentEnd = segment.end;
    } else if (!current) {
      chunks.push(...(await splitOversizedTextSegment(segment, budget, measure, startIndex + chunks.length)));
    } else {
      chunks.push(createTextChunk(current, startIndex + chunks.length, currentStart, currentEnd));
      const segmentUsage = await measure(segment.text);
      if (segmentUsage <= budget) {
        current = segment.text;
        currentStart = segment.start;
        currentEnd = segment.end;
      } else {
        chunks.push(...(await splitOversizedTextSegment(segment, budget, measure, startIndex + chunks.length)));
        current = '';
      }
    }

    onProgress?.([...chunks]);
  }

  if (current.trim()) chunks.push(createTextChunk(current, startIndex + chunks.length, currentStart, currentEnd));
  return chunks;
};
