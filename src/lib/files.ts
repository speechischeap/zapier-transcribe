import type { ZObject } from 'zapier-platform-core';

/**
 * Turns an Input File into a URL the Jobs API can download.
 *
 * Zapier hands a file field to the action as a proxy URL on zapier.com that ignores HTTP Range
 * requests. FFmpeg needs those to read MP4-family files whose index sits at the end, common in phone
 * and screen recordings, so such files would fail as shorter than six seconds. A copy in Zapier's
 * file storage supports Range requests and stays reachable while the job waits to start.
 */
export const fileToInputUrl = async (z: ZObject, file: string): Promise<string> => {
  // Check the status here: core's own check would show users a JSON dump with the signed URL.
  const download = await z.request({ raw: true, skipThrowForStatus: true, url: file });

  if (download.status >= 400) {
    throw new z.errors.Error(
      `Zapier could not read the file from the earlier step (HTTP ${download.status}). Check that the file still exists, confirm Zapier has permission to access it, and run the step again.`,
      'InputFileUnreadable',
      download.status,
    );
  }

  // Core types `stashFile` as returning a string and taking a promised response, but it resolves
  // asynchronously and also accepts a response that has already arrived:
  return await z.stashFile(Promise.resolve(download));
};
