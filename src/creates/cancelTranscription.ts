import type { Create, PerformFunction } from 'zapier-platform-core';

import { describeOptionsFor, transcriptionOutputFields } from '../lib/fields';
import { describeTranscription, type Job, SAMPLE_JOB_ID } from '../lib/jobs';
import { apiErrorMessage } from '../middleware';

const perform: PerformFunction = async (z, bundle) => {
  const id = String(bundle.inputData.id ?? '').trim();
  const url = `https://api.speechischeap.com/v2/jobs/${encodeURIComponent(id)}`;

  // Only a pending job can be canceled. The API answers 404 for a job that already finished, an
  // unknown ID, and another account's job alike, so read the job back to tell them apart:
  const canceled = await z.request({ method: 'DELETE', skipThrowForStatus: true, url });

  if (canceled.status >= 400 && canceled.status !== 404) {
    throw new z.errors.Error(apiErrorMessage(canceled), 'ApiError', canceled.status);
  }

  const read = await z.request({ skipThrowForStatus: true, url });

  if (read.status === 404) {
    throw new z.errors.Error(`No transcription found with ID ${id}.`, 'NotFound', 404);
  }

  if (read.status >= 400) {
    throw new z.errors.Error(apiErrorMessage(read), 'ApiError', read.status);
  }

  return describeTranscription(read.data as Job, describeOptionsFor(z, bundle.inputData));
};

export default {
  key: 'cancel_transcription',
  noun: 'Transcription',

  display: {
    description: 'Cancels an in-progress transcription so it is not billed.',
    label: 'Cancel Transcription',
  },

  operation: {
    cleanInputData: false,
    perform,
    sample: describeTranscription(
      { id: SAMPLE_JOB_ID, output: {}, status: 'CANCELED' },
      { includeJson: false, subtitleFileFor: () => '', timestamps: false },
    ) as unknown as { [key: string]: unknown },
    outputFields: transcriptionOutputFields,

    inputFields: [{
      helpText: 'Enter the ID of an in-progress transcription to cancel it before completion.',
      key: 'id',
      label: 'Transcription ID',
      placeholder: '00000000-1111-7222-b333-444444444444-sic',
      required: true,
      type: 'string',
    }],
  },
} satisfies Create;
