import { describe, expect, it } from 'vitest';

import type { Segment } from '../lib/jobs';
import { buildSubtitles, buildTranscript, dominantLanguage, formatClock } from '../lib/transcript';

const segment = (overrides: Partial<Segment>): Segment => ({
  confidence: 0.9,
  end: 1,
  id: 1,
  language: 'en (99.00%)',
  processing_duration_in_s: 0.01,
  start: 0,
  text: '',
  words: [],
  ...overrides,
});

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [4.9, '0:04'],
    [65, '1:05'],
    [3599.99, '59:59'],
    [3723, '1:02:03'],
  ])('formats %f seconds as %s', (seconds, clock) => {
    expect(formatClock(seconds)).toBe(clock);
  });
});

describe('buildTranscript', () => {
  const plain = { timestamps: false };

  it('joins a sentence that spans Segments and starts a paragraph after each full stop', () => {
    const segments = [
      segment({ end: 30, start: 0, text: 'So the plan was to' }),
      segment({ end: 41, start: 30, text: 'ship it on Friday.' }),
      segment({ end: 50, start: 41, text: 'Then it rained.' }),
    ];

    expect(buildTranscript(segments, plain))
      .toBe('So the plan was to ship it on Friday.\n\nThen it rained.');
  });

  it('names the Speaker at the start of each paragraph and when the Speaker changes', () => {
    const segments = [
      segment({ speaker_id: 'A', start: 0, text: 'Did it ship' }),
      segment({ speaker_id: 'B', start: 2, text: 'Not yet.' }),
      segment({ speaker_id: 'B', start: 4, text: 'Maybe Monday.' }),
    ];

    expect(buildTranscript(segments, plain))
      .toBe('Speaker A: Did it ship\n\nSpeaker B: Not yet.\n\nSpeaker B: Maybe Monday.');
  });

  it('shows non-speech sounds by their Audio label and leaves out silence', () => {
    const segments = [
      segment({ label: 'speech', start: 0, text: 'Welcome back to' }),
      segment({ label: 'music', language: null, start: 3, text: '' }),
      segment({ label: 'silence', language: null, start: 9, text: '' }),
      segment({ label: 'speech', start: 12, text: 'the show.' }),
    ];

    expect(buildTranscript(segments, plain)).toBe('Welcome back to\n\n[music]\n\nthe show.');
  });

  it('puts every Segment on its own timestamped line when asked to', () => {
    const segments = [
      segment({ speaker_id: 'A', start: 4.2, text: 'Welcome back.' }),
      segment({ label: 'music', language: null, start: 65, text: '' }),
      segment({ speaker_id: 'B', start: 3725, text: 'Thanks for having me' }),
    ];

    expect(buildTranscript(segments, { timestamps: true }))
      .toBe('[0:04] Speaker A: Welcome back.\n[1:05] [music]\n[1:02:05] Speaker B: Thanks for having me');
  });

  it('returns an empty string when nothing was said', () => {
    expect(buildTranscript([], plain)).toBe('');
    expect(buildTranscript([segment({ label: 'silence', text: '' })], plain)).toBe('');
  });
});

describe('dominantLanguage', () => {
  it('picks the language spoken for the longest time, not in the most Segments', () => {
    const segments = [
      segment({ end: 2, language: 'fr (91.00%)', start: 0 }),
      segment({ end: 4, language: 'fr (88.00%)', start: 2 }),
      segment({ end: 34, language: 'en (99.60%)', start: 4 }),
      segment({ end: 40, label: 'music', language: null, start: 34 }),
    ];

    expect(dominantLanguage(segments)).toBe('en');
  });

  it('handles three-letter codes and returns null without speech', () => {
    expect(dominantLanguage([segment({ language: 'haw (97.00%)' })])).toBe('haw');
    expect(dominantLanguage([segment({ language: null })])).toBeNull();
  });
});

describe('buildSubtitles', () => {
  const segments = [
    segment({ end: 2.5, speaker_id: 'A', start: 0.016, text: 'Hey everybody.' }),
    segment({ end: 9, label: 'silence', language: null, start: 2.5, text: '' }),
    segment({ end: 3725.0004, label: 'music', language: null, start: 3600, text: '' }),
  ];

  it('writes numbered SRT cues with comma milliseconds, skipping silence', () => {
    expect(buildSubtitles(segments, 'srt')).toBe([
      '1',
      '00:00:00,016 --> 00:00:02,500',
      'Speaker A: Hey everybody.',
      '',
      '2',
      '01:00:00,000 --> 01:02:05,000',
      '[music]',
      '',
    ].join('\n'));
  });

  it('writes a WEBVTT header and dot milliseconds for VTT', () => {
    expect(buildSubtitles(segments, 'vtt')).toBe([
      'WEBVTT',
      '',
      '00:00:00.016 --> 00:00:02.500',
      'Speaker A: Hey everybody.',
      '',
      '01:00:00.000 --> 01:02:05.000',
      '[music]',
      '',
    ].join('\n'));
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(buildSubtitles([], 'srt')).toBe('');
    expect(buildSubtitles([segment({ label: 'silence', text: '' })], 'vtt')).toBe('');
  });
});
