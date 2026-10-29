import type { HttpResponse, ZObject } from 'zapier-platform-core';

import { apiErrorMessage } from '../middleware';
import type { Job } from './jobs';

const isJob = (data: unknown): data is Job =>
  typeof data === 'object' && data !== null
  && typeof (data as Job).id === 'string' && typeof (data as Job).status === 'string';

/**
 * Takes the job out of a `GET /v2/jobs/:id` response made with `skipThrowForStatus`. Throws the
 * API's message for an error status, and a clear error for anything that is not a job, such as a
 * maintenance page answered with 200.
 */
export const jobFrom = (z: ZObject, response: HttpResponse): Job => {
  if (response.status >= 400) {
    throw new z.errors.Error(apiErrorMessage(response), 'ApiError', response.status);
  }

  if (!isJob(response.data)) {
    throw new z.errors.Error(
      `Speech is Cheap returned an unexpected response (HTTP ${response.status}). The service may be undergoing maintenance, so wait a few minutes and try the step again.`,
      'UnexpectedResponse',
      response.status,
    );
  }

  return response.data;
};
