import nock from 'nock';
import zapier from 'zapier-platform-core';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../index';
import { messageOf, rejectionOf } from './helpers';

const appTester = zapier.createAppTester(App);

const UPLOAD = 'https://upload.speechischeap.com';

afterEach(() => {
  nock.cleanAll();
});

const callUpload = () => appTester(
  async (z: any) => z.request({ method: 'POST', url: `${UPLOAD}/v2/jobs/` }),
  { authData: { token: 'sk_test' } },
);

describe('middleware', () => {
  it('sends the API key as a bearer token on every request', async () => {
    const scope = nock(UPLOAD, { reqheaders: { authorization: 'Bearer sk_test' } })
      .post('/v2/jobs/')
      .reply(200, {});

    await callUpload();

    expect(scope.isDone()).toBe(true);
  });

  it.each([
    [{ error: 'Unauthorized' }, 'Unauthorized'],
    [{ message: 'Missing required "input_file" parameter' }, 'Missing required "input_file" parameter'],
  ])('shows the message from a JSON error body %o', async (body, message) => {
    nock(UPLOAD).post('/v2/jobs/').reply(400, body);

    expect(messageOf(await rejectionOf(callUpload()))).toBe(message);
  });

  it('names the status and request when the error body is empty', async () => {
    nock(UPLOAD).post('/v2/jobs/').reply(500, '');

    expect(messageOf(await rejectionOf(callUpload())))
      .toBe('Speech is Cheap answered 500 to POST https://upload.speechischeap.com/v2/jobs/');
  });

  it('leaves the response alone when the caller handles the status itself', async () => {
    nock(UPLOAD).post('/v2/jobs/').reply(404, 'Not Found');

    const response = await appTester(
      async (z: any) => z.request({ method: 'POST', skipThrowForStatus: true, url: `${UPLOAD}/v2/jobs/` }),
      { authData: { token: 'sk_test' } },
    );

    expect(response.status).toBe(404);
  });
});
