import nock from 'nock';
import zapier from 'zapier-platform-core';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../index';
import { messageOf, rejectionOf } from './helpers';

const appTester = zapier.createAppTester(App);

const API = 'https://api.speechischeap.com';
const JOB_ID = '00000000-1111-7222-b333-444444444444-sic';
const CALLBACK_URL = 'https://auth-json-server.zapier-staging.com/echo';

const transcription = App.creates.transcription!.operation;

const defaultInput = {
  can_label_audio: false,
  can_parse_speakers: false,
  can_parse_words: false,
  input_url: 'https://example.com/audio.mp3',
  minimum_confidence: 0.5,
  segment_duration: 30,
};

const completedJob = {
  id: JOB_ID,
  status: 'COMPLETED',
  output: {
    duration: 25,
    request: { input_url: defaultInput.input_url },
    segments: [
      {
        confidence: 0.95,
        end: 2.5,
        id: 1,
        language: 'en (99.60%)',
        processing_duration_in_s: 0.03,
        start: 0,
        text: 'Hello there.',
        words: [],
      },
    ],
  },
};

// Zapier always sends `meta`; the app tester does not add it on its own.
const bundleWith = (bundle: Record<string, unknown>) => ({
  authData: { token: 'sk_test' },
  meta: { isLoadingSample: false },
  ...bundle,
});

afterEach(() => {
  nock.cleanAll();
});

describe('Transcribe Audio: input fields', () => {
  const fields = transcription.inputFields as Array<{ choices?: unknown[]; group?: string; key: string; required?: boolean; type?: string }>;

  it('accepts an Input File as an alternative to an optional Input URL', () => {
    expect(fields.find(({ key }) => key === 'input_url')).toMatchObject({ required: false, type: 'string' });
    expect(fields.find(({ key }) => key === 'input_file')).toMatchObject({ required: false, type: 'file' });
  });

  it('offers a language dropdown and tucks the fine-tuning settings into Advanced Options', () => {
    expect(fields.find(({ key }) => key === 'language')?.choices).toHaveLength(100);
    expect(fields.filter(({ group }) => group === 'advanced').map(({ key }) => key)).toEqual([
      'is_split_channel',
      'is_private',
      'minimum_confidence',
      'segment_duration',
      'can_include_json',
    ]);
  });

  it('no longer offers the inputs the Jobs API dropped in 2.8.0', () => {
    const keys = (transcription.inputFields as Array<{ key: string }>).map((field) => field.key);

    expect(keys).not.toContain('hotwords');
    expect(keys).not.toContain('prompt');
  });
});

describe('Transcribe Audio: perform', () => {
  it('starts a job with a callback URL and returns the pending job', async () => {
    let sentBody: Record<string, unknown> = {};

    nock(API, { reqheaders: { authorization: 'Bearer sk_test' } })
      .post('/v2/jobs/', (body) => {
        sentBody = body;
        return true;
      })
      .reply(202, { id: JOB_ID, output: {}, status: 'PENDING' });

    const result = await appTester(transcription.perform, bundleWith({
      inputData: { ...defaultInput, can_include_json: true, can_include_timestamps: true },
    }));

    expect(result).toMatchObject({ id: JOB_ID, status: 'PENDING' });
    expect(sentBody).toMatchObject({ ...defaultInput, webhook_url: CALLBACK_URL });
    expect(sentBody).not.toHaveProperty('can_include_json');
    expect(sentBody).not.toHaveProperty('can_include_timestamps');
  });

  it('sends the language, privacy, and channel settings, and nothing blank', async () => {
    let sentBody: Record<string, unknown> = {};

    nock(API)
      .post('/v2/jobs/', (body) => {
        sentBody = body;
        return true;
      })
      .reply(202, { id: JOB_ID, output: {}, status: 'PENDING' });

    await appTester(transcription.perform, bundleWith({
      inputData: {
        ...defaultInput,
        can_include_timestamps: '',
        is_private: true,
        is_split_channel: true,
        language: 'fr',
        segment_duration: '',
      },
    }));

    expect(sentBody).toEqual({
      can_label_audio: false,
      can_parse_speakers: false,
      can_parse_words: false,
      input_url: defaultInput.input_url,
      is_private: true,
      is_split_channel: true,
      language: 'fr',
      minimum_confidence: 0.5,
      webhook_url: CALLBACK_URL,
    });
  });

  it.each([
    [{ input_url: '' }, 'Provide either an Input URL or an Input File to transcribe.'],
    [{ input_file: 'https://zapier.com/engine/hydrate/1/.x/' }, 'Provide either an Input URL or an Input File, not both.'],
    [{ segment_duration: 5 }, 'Segment duration must be between 6 and 30 seconds'],
    [{ segment_duration: 31 }, 'Segment duration must be between 6 and 30 seconds'],
    [{ minimum_confidence: -0.1 }, 'Minimum confidence must be between 0.0 and 1.0'],
    [{ minimum_confidence: 1.1 }, 'Minimum confidence must be between 0.0 and 1.0'],
  ])('rejects invalid settings %o before calling the API', async (override, message) => {
    await expect(
      appTester(transcription.perform, bundleWith({
        inputData: { ...defaultInput, ...override },
      })),
    ).rejects.toThrow(message);
  });

  it('reports the API error when the job cannot start', async () => {
    nock(API)
      .post('/v2/jobs/')
      .reply(400, 'Input URL is not reachable: https://example.com/audio.mp3 (HTTP 404)');

    const error = await rejectionOf(appTester(transcription.perform, bundleWith({
      inputData: defaultInput,
    })));

    expect(messageOf(error)).toBe('Input URL is not reachable: https://example.com/audio.mp3 (HTTP 404)');
  });

  it('fails when the API accepts the job without an ID', async () => {
    nock(API).post('/v2/jobs/').reply(202, {});

    await expect(
      appTester(transcription.perform, bundleWith({
        inputData: defaultInput,
      })),
    ).rejects.toThrow('no job ID was returned');
  });

  it('returns a sample without calling the API while the editor loads a sample', async () => {
    const result = await appTester(transcription.perform, bundleWith({
      inputData: { ...defaultInput, can_include_json: true, can_parse_speakers: true },
      meta: { isLoadingSample: true },
    }));

    expect(result).toMatchObject({ id: JOB_ID, language: 'en', status: 'COMPLETED' });
    expect(result.text).toMatch(/^Speaker A: SAMPLE\./);
    expect(result.output.segments[0]).toMatchObject({ speaker_id: 'A' });
    expect(typeof result.json).toBe('string');
    expect(nock.pendingMocks()).toEqual([]);
  });
});

describe('Transcribe Audio: performResume', () => {
  it('returns the completed job', async () => {
    const result = await appTester(transcription.performResume!, bundleWith({
      cleanedRequest: structuredClone(completedJob),
      inputData: defaultInput,
    }));

    expect(result).toMatchObject({
      id: JOB_ID,
      language: 'en',
      status: 'COMPLETED',
      text: 'Hello there.',
    });
    expect(result.output.segments).toHaveLength(1);
  });

  it('adds SRT and VTT Subtitles and a lazy SRT file', async () => {
    const result = await appTester(transcription.performResume!, bundleWith({
      cleanedRequest: structuredClone(completedJob),
      inputData: defaultInput,
    }));

    expect(result.srt).toBe('1\n00:00:00,000 --> 00:00:02,500\nHello there.\n');
    expect(result.vtt).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHello there.\n');
    expect(result.srt_file).toMatch(/^hydrate\|\|\|.*hydrators\.subtitleFile.*\|\|\|hydrate$/);
    expect(result.srt_file).toContain(JOB_ID);
  });

  it('reads the string "false" that performResume can receive as no', async () => {
    const result = await appTester(transcription.performResume!, bundleWith({
      cleanedRequest: structuredClone(completedJob),
      inputData: { ...defaultInput, can_include_json: 'false', can_include_timestamps: 'false' },
    }));

    expect(result.text).toBe('Hello there.');
    expect(result).not.toHaveProperty('json');
  });

  it('adds timestamps to the transcript when asked to', async () => {
    const result = await appTester(transcription.performResume!, bundleWith({
      cleanedRequest: structuredClone(completedJob),
      inputData: { ...defaultInput, can_include_timestamps: true },
    }));

    expect(result.text).toBe('[0:00] Hello there.');
  });

  it('drops the query string Zapier adds to the callback', async () => {
    const result = await appTester(transcription.performResume!, bundleWith({
      cleanedRequest: { ...structuredClone(completedJob), querystring: {} },
      inputData: { ...defaultInput, can_include_json: true },
    }));

    expect(result).not.toHaveProperty('querystring');
    expect(JSON.parse(result.json)).not.toHaveProperty('querystring');
  });

  it('adds the raw JSON when asked to', async () => {
    const result = await appTester(transcription.performResume!, bundleWith({
      cleanedRequest: structuredClone(completedJob),
      inputData: { ...defaultInput, can_include_json: true },
    }));

    expect(JSON.parse(result.json)).toEqual(completedJob);
  });

  it.each([
    'Expected at least 6 seconds; got 2.5 seconds',
    'Expected at most 86400 seconds; got at least 90000 seconds',
    'The input language ("xx") does not appear in the list of supported languages: af, am, ar',
    "'minimum_confidence' must be between 0.0 and 1.0.",
  ])('halts the Zap on a permanent failure: %s', async (error) => {
    await expect(
      appTester(transcription.performResume!, bundleWith({
        cleanedRequest: { id: JOB_ID, output: { error }, status: 'FAILED' },
        inputData: defaultInput,
      })),
    ).rejects.toMatchObject({ message: expect.stringContaining(error), name: 'HaltedError' });
  });

  it('fails the step, so Autoreplay can retry, for other failures', async () => {
    await expect(
      appTester(transcription.performResume!, bundleWith({
        cleanedRequest: {
          id: JOB_ID,
          output: { error: 'FFmpeg process returned non-zero exit code 1.' },
          status: 'FAILED',
        },
        inputData: defaultInput,
      })),
    ).rejects.toThrow('FFmpeg process returned non-zero exit code 1.');
  });

  it('halts the Zap when someone canceled the transcription', async () => {
    await expect(
      appTester(transcription.performResume!, bundleWith({
        cleanedRequest: { id: JOB_ID, output: {}, status: 'CANCELED' },
        inputData: defaultInput,
      })),
    ).rejects.toMatchObject({ name: 'HaltedError' });
  });
});
