import type { Bundle, ZObject } from 'zapier-platform-core';

import { type Job, SAMPLE_JOB_ID, sampleJob } from './lib/jobs';
import { buildSubtitles } from './lib/transcript';

// Builds the SRT file only when a later Zap step asks for it, such as a Google Drive upload.
export const subtitleFile = async (z: ZObject, bundle: Bundle) => {
  const id = String(bundle.inputData.id);

  // Reading a job needs no API key, so this also works after the Connection changes:
  const job = id === SAMPLE_JOB_ID
    ? sampleJob({ labels: false, request: {}, speakers: false, words: false })
    : (await z.request({ url: `https://api.speechischeap.com/v2/jobs/${id}` })).data as Job;

  const srt = buildSubtitles(job.output?.segments ?? [], 'srt');

  if (!srt) {
    throw new z.errors.Error(
      `Transcription ${id} has no subtitles. Speech is Cheap deletes the segments of a private transcription 12 hours after it finishes.`,
      'SubtitlesUnavailable',
      404,
    );
  }

  return z.stashFile(srt, undefined, `${id}.srt`, 'application/x-subrip');
};
