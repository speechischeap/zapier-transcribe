import type { ZObject } from 'zapier-platform-core';

/**
 * Turns an Input File into a URL the Jobs API can download.
 *
 * Zapier hands a file field to the action as a proxy URL on zapier.com that ignores HTTP Range
 * requests. FFmpeg needs those to read MP4-family files whose index sits at the end, common in phone
 * and screen recordings, so such files would fail as shorter than six seconds. A copy in Zapier's
 * file storage supports Range requests and stays reachable while the job waits to start.
 */
export const fileToInputUrl = async (z: ZObject, file: string): Promise<string> =>
  // Core types `stashFile` as returning a string, but it resolves asynchronously:
  await z.stashFile(z.request({ raw: true, url: file }));
