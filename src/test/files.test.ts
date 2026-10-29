import { describe, expect, it, vi } from 'vitest';

import { fileToInputUrl } from '../lib/files';

describe('fileToInputUrl', () => {
  it('streams the Zapier file into Zapier file storage and returns the stored URL', async () => {
    const download = Promise.resolve({ status: 200 });
    const z = {
      request: vi.fn(() => download),
      stashFile: vi.fn(async () => 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/1/token'),
    };

    const url = await fileToInputUrl(z as any, 'https://zapier.com/engine/hydrate/1/.payload/');

    expect(url).toBe('https://zapier-dev-files.s3.amazonaws.com/cli-platform/1/token');
    expect(z.request).toHaveBeenCalledWith({ raw: true, url: 'https://zapier.com/engine/hydrate/1/.payload/' });
    expect(z.stashFile).toHaveBeenCalledWith(download);
  });
});
