import { describe, expect, it } from 'vitest';

import { buildJobRequest } from '../lib/jobs';
import { LANGUAGES } from '../lib/languages';

describe('buildJobRequest', () => {
  it('keeps only Jobs API fields and leaves blank ones to the API defaults', () => {
    const { errors, request } = buildJobRequest({
      can_include_json: true,
      can_include_timestamps: true,
      can_label_audio: '',
      can_parse_speakers: true,
      can_parse_words: false,
      copy: null,
      input_url: '  https://example.com/a.mp3 ',
      is_private: 'true',
      is_split_channel: 'false',
      language: '',
      minimum_confidence: '0.7',
      segment_duration: undefined,
      unknown_field: 'x',
    });

    expect(errors).toEqual([]);
    expect(request).toEqual({
      can_parse_speakers: true,
      can_parse_words: false,
      input_url: 'https://example.com/a.mp3',
      is_private: true,
      is_split_channel: false,
      minimum_confidence: 0.7,
    });
  });

  it('passes the chosen language through', () => {
    expect(buildJobRequest({ input_url: 'https://example.com/a.mp3', language: 'jw' }).request)
      .toMatchObject({ language: 'jw' });
  });

  it.each([
    [{ segment_duration: 5 }, 'Segment duration must be between 6 and 30 seconds'],
    [{ segment_duration: 'thirty' }, 'Segment duration must be between 6 and 30 seconds'],
    [{ minimum_confidence: 1.5 }, 'Minimum confidence must be between 0.0 and 1.0'],
    [{ minimum_confidence: 'high' }, 'Minimum confidence must be between 0.0 and 1.0'],
  ])('reports %o as invalid', (input, message) => {
    const { errors } = buildJobRequest({ input_url: 'https://example.com/a.mp3', ...input });

    expect(errors.join('\n')).toContain(message);
  });
});

describe('LANGUAGES', () => {
  it('lists the 100 documented codes once each, with Javanese as jw', () => {
    const codes = LANGUAGES.map(({ value }) => value);

    expect(new Set(codes).size).toBe(100);
    expect(codes).toContain('jw');
    expect(codes).not.toContain('jv');
  });
});

describe('buildJobRequest inputs', () => {
  it('needs an Input URL or an Input File', () => {
    expect(buildJobRequest({}).errors).toEqual(['- Provide either an Input URL or an Input File to transcribe.']);
  });

  it('refuses both at once', () => {
    expect(buildJobRequest({ input_file: 'https://zapier.com/engine/hydrate/1/.x/', input_url: 'https://example.com/a.mp3' }).errors)
      .toEqual(['- Provide either an Input URL or an Input File, not both.']);
  });

  it('leaves the Input File for perform to turn into a URL', () => {
    const { errors, request } = buildJobRequest({ input_file: 'https://zapier.com/engine/hydrate/1/.x/' });

    expect(errors).toEqual([]);
    expect(request).not.toHaveProperty('input_url');
    expect(request).not.toHaveProperty('input_file');
  });
});
