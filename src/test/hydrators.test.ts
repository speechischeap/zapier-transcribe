import zapier from 'zapier-platform-core';
import { describe, expect, it, vi } from 'vitest';

import { subtitleFile } from '../hydrators';
import { SAMPLE_JOB_ID } from '../lib/jobs';
import { messageOf, rejectionOf } from './helpers';

const JOB_ID = '01a18913-8ef8-7275-a791-13fa116a212b-sic';

// `z.stashFile` needs Zapier's backend, so these tests hand the hydrator a stand-in `z`:
const fakeZ = (job?: unknown) => ({
  errors: zapier.errors,
  request: vi.fn(async () => ({ data: job })),
  stashFile: vi.fn(async () => 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/example.srt'),
});

describe('subtitleFile hydrator', () => {
  it('reads the job without an API key and stashes its SRT under the Transcription ID', async () => {
    const z = fakeZ({
      id: JOB_ID,
      output: { segments: [{ end: 1, id: 1, language: 'en (99%)', start: 0, text: 'Hi.', words: [] }] },
      status: 'COMPLETED',
    });

    const url = await subtitleFile(z as any, { inputData: { id: JOB_ID } } as any);

    expect(url).toMatch(/^https:\/\//);
    expect(z.request).toHaveBeenCalledWith({ url: `https://api.speechischeap.com/v2/jobs/${JOB_ID}` });
    expect(z.stashFile).toHaveBeenCalledWith(
      '1\n00:00:00,000 --> 00:00:01,000\nHi.\n',
      undefined,
      `${JOB_ID}.srt`,
      'application/x-subrip',
    );
  });

  it('builds the Sample file without calling the API', async () => {
    const z = fakeZ();

    await subtitleFile(z as any, { inputData: { id: SAMPLE_JOB_ID } } as any);

    expect(z.request).not.toHaveBeenCalled();
    expect(z.stashFile.mock.calls[0]?.[0]).toContain('SAMPLE.');
  });

  it('explains when a private transcription no longer has segments', async () => {
    const z = fakeZ({ id: JOB_ID, output: { segments: [] }, status: 'COMPLETED' });

    const error = await rejectionOf(subtitleFile(z as any, { inputData: { id: JOB_ID } } as any));

    expect(messageOf(error)).toMatch(/has no subtitles/);
    expect(z.stashFile).not.toHaveBeenCalled();
  });
});
