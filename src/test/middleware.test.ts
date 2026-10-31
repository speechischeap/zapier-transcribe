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
    'http://api.speechischeap.com/v2/jobs/auth',
    'https://docs.speechischeap.com/errors/',
    'https://api.speechischeap.com.example.com/v2/jobs/auth',
  ])('keeps the API key off %s', async (url) => {
    const { host, pathname, protocol } = new URL(url);
    const scope = nock(`${protocol}//${host}`, { badheaders: ['authorization'] }).get(pathname).reply(200, 'ok');

    await appTester(async (z: any) => z.request({ url }), { authData: { token: 'sk_test' } });

    expect(scope.isDone()).toBe(true);
  });

  it('keeps the API key away from other hosts, such as the Zapier URL of an Input File', async () => {
    // `badheaders` makes the interceptor match only when no Authorization header is sent:
    const scope = nock('https://zapier.com', { badheaders: ['authorization'] })
      .get('/engine/hydrate/1/.payload/')
      .reply(200, 'audio');

    await appTester(
      async (z: any) => z.request({ url: 'https://zapier.com/engine/hydrate/1/.payload/' }),
      { authData: { token: 'sk_test' } },
    );

    expect(scope.isDone()).toBe(true);
  });

  it.each([
    [{ error: 'Unauthorized' }, 'Unauthorized'],
    [{ message: 'Missing required "input_file" parameter' }, 'Missing required "input_file" parameter'],
  ])('shows the message from a JSON error body %o', async (body, message) => {
    nock(UPLOAD).post('/v2/jobs/').reply(400, body);

    expect(messageOf(await rejectionOf(callUpload()))).toBe(message);
  });

  it.each([
    [{ error: { code: 1 } }],
    [{ error: '' }],
    [{ detail: 'unrelated' }],
  ])('falls back to the status line when a JSON body %o has no usable message', async (body) => {
    nock(UPLOAD).post('/v2/jobs/').reply(400, body);

    expect(messageOf(await rejectionOf(callUpload())))
      .toBe('Speech is Cheap answered 400 to POST https://upload.speechischeap.com/v2/jobs/');
  });

  it('shows the title of a proxy error page instead of its HTML', async () => {
    nock(UPLOAD)
      .post('/v2/jobs/')
      .reply(502, '<html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center></body></html>');

    expect(messageOf(await rejectionOf(callUpload()))).toBe('502 Bad Gateway');
  });

  it('cuts very long messages short', async () => {
    nock(UPLOAD).post('/v2/jobs/').reply(500, 'x'.repeat(5000));

    const message = messageOf(await rejectionOf(callUpload()));

    expect(message).toHaveLength(1000);
    expect(message.endsWith('…')).toBe(true);
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
