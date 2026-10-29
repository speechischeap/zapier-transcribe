import type { Segment } from './jobs';

export interface TranscriptOptions {
  timestamps: boolean;
}

// Ends with sentence punctuation, including CJK, Arabic, and Devanagari marks, allowing closing quotes
// or brackets after it:
const SENTENCE_END = /[.!?…。．！？؟।]["'”’」』)）\]]*$/;

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

export type SubtitleFormat = 'srt' | 'vtt';

// 00:01:02,345 in SRT, 00:01:02.345 in VTT:
const formatCueTime = (seconds: number, format: SubtitleFormat): string => {
  const totalMs = Math.max(Math.round(seconds * 1000), 0);
  const ms = String(totalMs % 1000).padStart(3, '0');
  const totalSeconds = Math.floor(totalMs / 1000);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');

  return `${hh}:${mm}:${ss}${format === 'srt' ? ',' : '.'}${ms}`;
};

/**
 * Builds Subtitles with one cue per Segment, like the API's own `output_format`, but keeps the
 * Speaker in front of each cue and leaves out silence instead of writing empty cues.
 */
export const buildSubtitles = (segments: Segment[], format: SubtitleFormat): string => {
  const cues = segments
    .map((segment) => ({ content: contentOf(segment), segment }))
    .filter(({ content }) => content)
    .map(({ content, segment }, index) => {
      const timing = `${formatCueTime(segment.start, format)} --> ${formatCueTime(segment.end, format)}`;
      const cue = `${timing}\n${speakerOf(segment)}${content}`;

      return format === 'srt' ? `${index + 1}\n${cue}` : cue;
    });

  if (!cues.length) {
    return '';
  }

  return `${format === 'vtt' ? 'WEBVTT\n\n' : ''}${cues.join('\n\n')}\n`;
};
