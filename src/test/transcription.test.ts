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
      inputData: { ...defaultInput, can_include_json: true },
    }));

    expect(result).toMatchObject({ id: JOB_ID, status: 'PENDING' });
    expect(sentBody).toMatchObject({ ...defaultInput, webhook_url: CALLBACK_URL });
    expect(sentBody).not.toHaveProperty('can_include_json');
  });

  it.each([
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

    expect(result).toMatchObject({ id: JOB_ID, status: 'COMPLETED' });
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

    expect(result).toMatchObject({ id: JOB_ID, status: 'COMPLETED' });
    expect(result.output.segments).toHaveLength(1);
  });

  it('adds the raw JSON when asked to', async () => {
    const result = await appTester(transcription.performResume!, bundleWith({
      cleanedRequest: structuredClone(completedJob),
      inputData: { ...defaultInput, can_include_json: true },
    }));

    expect(JSON.parse(result.json)).toMatchObject({ id: JOB_ID });
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
