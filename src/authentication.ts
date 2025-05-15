import type { Authentication, Request } from 'zapier-platform-core';

export default {
  type: 'custom',

  fields: [{
    helpText: "API token for Speech is Cheap.\nDon't have one? Sign up at [speechischeap.com](https://speechischeap.com)",
    key: 'token',
    label: 'API Token',
    required: true,
    type: 'string',
  }],

  test: async (z, bundle) => {
    await z.request({
      headers: { Authorization: `Bearer ${bundle.authData.token}` },
      url: 'https://api.speechischeap.com/v2/jobs/auth',
    });
  },
} satisfies Authentication;
