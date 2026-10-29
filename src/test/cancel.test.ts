import nock from 'nock';
import zapier from 'zapier-platform-core';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../index';
import { messageOf, rejectionOf } from './helpers';

const appTester = zapier.createAppTester(App);

const API = 'https://api.speechischeap.com';
const JOB_ID = '01a18913-8ef8-7275-a791-13fa116a212b-sic';

const cancel = App.creates.cancel_transcription!.operation;

const bundleWith = (inputData: Record<string, unknown>) => ({
  authData: { token: 'sk_test' },
  inputData,
  meta: { isLoadingSample: false },
});

afterEach(() => {
  nock.cleanAll();
});

describe('Cancel Transcription', () => {
  it('cancels a pending transcription with the API key and returns its new status', async () => {
    const deleted = nock(API, { reqheaders: { authorization: 'Bearer sk_test' } })
      .delete(`/v2/jobs/${JOB_ID}`)
      .reply(200, 'OK');

    nock(API).get(`/v2/jobs/${JOB_ID}`).reply(200, { id: JOB_ID, output: {}, status: 'CANCELED' });

    const result = await appTester(cancel.perform, bundleWith({ id: JOB_ID }));

    expect(deleted.isDone()).toBe(true);
    expect(result).toMatchObject({ id: JOB_ID, status: 'CANCELED', text: '' });
  });

  it('returns the finished transcription when it completed before the cancel arrived', async () => {
    nock(API).delete(`/v2/jobs/${JOB_ID}`).reply(404, '404 Not Found');
    nock(API)
      .get(`/v2/jobs/${JOB_ID}`)
      .reply(200, {
        id: JOB_ID,
        output: { segments: [{ end: 1, id: 1, language: 'en (99%)', start: 0, text: 'Too late.', words: [] }] },
        status: 'COMPLETED',
      });

    const result = await appTester(cancel.perform, bundleWith({ id: JOB_ID }));

    expect(result).toMatchObject({ status: 'COMPLETED', text: 'Too late.' });
  });

  it('fails clearly for an unknown ID', async () => {
    nock(API).delete('/v2/jobs/nope-sic').reply(404, '404 Not Found');
    nock(API).get('/v2/jobs/nope-sic').reply(404, '404 Not Found');

    const error = await rejectionOf(appTester(cancel.perform, bundleWith({ id: 'nope-sic' })));

    expect(messageOf(error)).toBe('No transcription found with ID nope-sic.');
  });

  it('shows the API message when the cancel request itself fails', async () => {
    nock(API)
      .delete(`/v2/jobs/${JOB_ID}`)
      .reply(402, 'Speech is Cheap: Missing subscription. Manage your subscriptions at https://billing.speechischeap.com/.');

    const error = await rejectionOf(appTester(cancel.perform, bundleWith({ id: JOB_ID })));

    expect(messageOf(error)).toMatch(/^Speech is Cheap: Missing subscription/);
  });
});
