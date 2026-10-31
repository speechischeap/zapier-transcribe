import zapier from 'zapier-platform-core';
import { describe, expect, it, vi } from 'vitest';

import App from '../index';
import { fileToInputUrl } from '../lib/files';
import { messageOf, rejectionOf } from './helpers';

const HYDRATE_URL = 'https://zapier.com/engine/hydrate/1/.payload/';
const STASHED_URL = 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/1/token';
const CALLBACK_URL = 'https://hooks.zapier.com/callback';

// `z.stashFile` needs Zapier's backend, so these tests hand the code a stand-in `z`:
const fakeZ = (downloadStatus = 200) => {
  const posted: Array<Record<string, unknown>> = [];
  const z = {
    errors: zapier.errors,
    generateCallbackUrl: () => CALLBACK_URL,
    posted,
    request: vi.fn(async (options: { body?: Record<string, unknown>; method?: string; raw?: boolean }) => {
      if (options.raw) {
        return { status: downloadStatus };
      }

      posted.push(options.body ?? {});
      return { data: { id: 'job-1-sic', output: {}, status: 'PENDING' }, status: 202 };
    }),
    stashFile: vi.fn(async () => STASHED_URL),
  };

  return z;
};

describe('fileToInputUrl', () => {
  it('downloads the Zapier file and stores a copy, returning the copy URL', async () => {
    const z = fakeZ();

    expect(await fileToInputUrl(z as any, HYDRATE_URL)).toBe(STASHED_URL);
    expect(z.request).toHaveBeenCalledWith({ raw: true, skipThrowForStatus: true, url: HYDRATE_URL });
    await expect(z.stashFile.mock.calls[0]?.[0]).resolves.toEqual({ status: 200 });
  });

  it('explains a file Zapier cannot read, without a JSON dump or the signed URL', async () => {
    const z = fakeZ(502);

    const error = await rejectionOf(fileToInputUrl(z as any, HYDRATE_URL));

    expect(messageOf(error)).toBe(
      'Zapier could not read the file from the earlier step (HTTP 502). Check that the file still exists, confirm Zapier has permission to access it, and run the step again.',
    );
    expect(messageOf(error)).not.toContain('hydrate');
    expect(z.stashFile).not.toHaveBeenCalled();
  });
});

describe('Transcribe Audio with an Input File', () => {
  const perform = App.creates.transcription!.operation.perform as any;

  it('creates the job from the stored copy and never sends the Input File itself', async () => {
    const z = fakeZ();

    const result = await perform(z, {
      authData: { token: 'sk_test' },
      inputData: { input_file: HYDRATE_URL, is_private: true },
      meta: { isLoadingSample: false },
    });

    expect(result).toMatchObject({ id: 'job-1-sic', status: 'PENDING' });
    expect(z.posted).toEqual([{ input_url: STASHED_URL, is_private: true, webhook_url: CALLBACK_URL }]);
  });

  it('does not download or store anything while the editor loads a Sample', async () => {
    const z = fakeZ();

    await perform({ ...z, dehydrateFile: () => 'hydrate|||sample|||hydrate' }, {
      authData: { token: 'sk_test' },
      inputData: { input_file: HYDRATE_URL },
      meta: { isLoadingSample: true },
    });

    expect(z.request).not.toHaveBeenCalled();
    expect(z.stashFile).not.toHaveBeenCalled();
  });
});
