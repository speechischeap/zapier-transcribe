import nock from 'nock';
import zapier from 'zapier-platform-core';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../index';
import { messageOf, rejectionOf } from './helpers';

const appTester = zapier.createAppTester(App);

const API = 'https://api.speechischeap.com';
const JOB_ID = '01a18913-8ef8-7275-a791-13fa116a212b-sic';

const search = App.searches.transcription!.operation;

const bundleWith = (inputData: Record<string, unknown>) => ({
  authData: { token: 'sk_test' },
  inputData,
  meta: { isLoadingSample: false },
});

afterEach(() => {
  nock.cleanAll();
});

describe('Find Transcription', () => {
  it('returns the completed transcription with its Transcript and Subtitles', async () => {
    nock(API)
      .get(`/v2/jobs/${JOB_ID}`)
      .reply(200, {
        id: JOB_ID,
        output: {
          duration: 3,
          request: {},
          segments: [{ end: 2, id: 1, language: 'en (99.00%)', start: 0, text: 'Found it.', words: [] }],
        },
        status: 'COMPLETED',
      });

    const results = await appTester(search.perform, bundleWith({ can_include_timestamps: true, id: ` ${JOB_ID} ` }));

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: JOB_ID,
      language: 'en',
      srt: '1\n00:00:00,000 --> 00:00:02,000\nFound it.\n',
      status: 'COMPLETED',
      text: '[0:00] Found it.',
    });
    expect(results[0].srt_file).toMatch(/^hydrate\|\|\|/);
  });

  it('returns a pending transcription with empty results', async () => {
    nock(API).get(`/v2/jobs/${JOB_ID}`).reply(200, { id: JOB_ID, output: {}, status: 'PENDING' });

    const [result] = await appTester(search.perform, bundleWith({ id: JOB_ID }));

    expect(result).toMatchObject({ id: JOB_ID, language: null, srt: '', srt_file: '', status: 'PENDING', text: '' });
  });

  it('finds nothing when the API does not know the ID', async () => {
    nock(API).get('/v2/jobs/nope-sic').reply(404, '404 Not Found');

    expect(await appTester(search.perform, bundleWith({ id: 'nope-sic' }))).toEqual([]);
  });

  it('shows the API message for other errors', async () => {
    nock(API).get(`/v2/jobs/${JOB_ID}`).reply(500, 'Internal Server Error');

    const error = await rejectionOf(appTester(search.perform, bundleWith({ id: JOB_ID })));

    expect(messageOf(error)).toBe('Internal Server Error');
  });

  it('offers the same output fields as Transcribe Audio', () => {
    expect(search.outputFields).toEqual(App.creates.transcription!.operation.outputFields);
    expect(Object.keys(search.sample)).toEqual(Object.keys(App.creates.transcription!.operation.sample));
  });
});
