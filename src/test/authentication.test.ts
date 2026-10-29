import nock from 'nock';
import zapier from 'zapier-platform-core';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../index';

const appTester = zapier.createAppTester(App);

const API = 'https://api.speechischeap.com';

afterEach(() => {
  nock.cleanAll();
});

describe('authentication', () => {
  it('passes when the API accepts the token', async () => {
    const scope = nock(API, { reqheaders: { authorization: 'Bearer sk_test' } })
      .get('/v2/jobs/auth')
      .reply(200, 'Authenticated');

    await appTester(App.authentication.test, { authData: { token: 'sk_test' } });

    expect(scope.isDone()).toBe(true);
  });

  it('fails when the API rejects the token', async () => {
    nock(API).get('/v2/jobs/auth').reply(401, 'Speech is Cheap: Unauthorized API Key.');

    await expect(
      appTester(App.authentication.test, { authData: { token: 'sk_bad' } }),
    ).rejects.toThrow();
  });
});
