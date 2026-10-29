import type { Segment } from './jobs';

export interface TranscriptOptions {
  timestamps: boolean;
}

// Ends with sentence punctuation, allowing closing quotes or brackets after it:
const SENTENCE_END = /[.!?…]["'”’)\]]*$/;

// Speech keeps its text. Other sounds show their audio label, such as [music]. Silence shows nothing.
const contentOf = (segment: Segment): string => {
  const text = segment.text.trim();

  if (text) {
    return text;
  }

  if (segment.label && segment.label !== 'speech' && segment.label !== 'silence') {
    return `[${segment.label}]`;
  }

  return '';
};

const speakerOf = (segment: Segment): string => (segment.speaker_id ? `Speaker ${segment.speaker_id}: ` : '');

// [0:04] below an hour, [1:02:03] from an hour on:
export const formatClock = (seconds: number): string => {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, '0');

  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
};

/**
 * Builds the Transcript from the Segments.
 *
 * With timestamps, every Segment gets its own line: `[0:04] Speaker A: text`.
 * Without them, Segments flow into paragraphs. A new paragraph starts after a Segment that ends a
 * sentence, when the Speaker changes, and around non-speech sounds.
 */
export const buildTranscript = (segments: Segment[], { timestamps }: TranscriptOptions): string => {
  const visible = segments
    .map((segment) => ({ content: contentOf(segment), segment }))
    .filter(({ content }) => content);

  if (timestamps) {
    return visible
      .map(({ content, segment }) => `[${formatClock(segment.start)}] ${speakerOf(segment)}${content}`)
      .join('\n');
  }

  const paragraphs: string[] = [];
  let previous: { content: string; segment: Segment } | undefined;

  for (const current of visible) {
    const continues = previous
      && !SENTENCE_END.test(previous.content)
      && previous.segment.speaker_id === current.segment.speaker_id
      && previous.segment.text.trim() !== ''
      && current.segment.text.trim() !== '';

    if (continues) {
      paragraphs[paragraphs.length - 1] += ` ${current.content}`;
    } else {
      paragraphs.push(`${speakerOf(current.segment)}${current.content}`);
    }

    previous = current;
  }

  return paragraphs.join('\n\n');
};

/**
 * Picks the language spoken for the longest total time, as an ISO code such as `en`. Each Segment
 * reports its language like `en (99.60%)`; non-speech Segments report none.
 */
export const dominantLanguage = (segments: Segment[]): string | null => {
  const totals = new Map<string, number>();

  for (const segment of segments) {
    const code = segment.language?.match(/^([a-z]{2,3})\b/)?.[1];

    if (code) {
      totals.set(code, (totals.get(code) ?? 0) + Math.max(segment.end - segment.start, 0));
    }
  }

  let best: string | null = null;

  for (const [code, seconds] of totals) {
    if (best === null || seconds > (totals.get(best) ?? 0)) {
      best = code;
    }
  }

  return best;
};
