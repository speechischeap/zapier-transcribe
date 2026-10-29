import nock from 'nock';
import zapier from 'zapier-platform-core';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../index';
import { messageOf, rejectionOf } from './helpers';

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

  it.each([
    [401, 'Speech is Cheap: Unauthorized API Key.'],
    [402, 'Speech is Cheap: Missing subscription. Manage your subscriptions at https://billing.speechischeap.com/.'],
  ])('shows the API message when the API answers %i', async (status, message) => {
    nock(API).get('/v2/jobs/auth').reply(status, message);

    const error = await rejectionOf(appTester(App.authentication.test, { authData: { token: 'sk_bad' } }));

    expect(messageOf(error)).toBe(message);
  });
});
