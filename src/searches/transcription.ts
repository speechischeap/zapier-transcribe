import type { PerformFunction, Search } from 'zapier-platform-core';

import {
  advancedGroup,
  describeOptionsFor,
  jsonField,
  timestampsField,
  transcriptionOutputFields,
  transcriptionSample,
} from '../lib/fields';
import { describeTranscription, type Job } from '../lib/jobs';
import { apiErrorMessage } from '../middleware';

const perform: PerformFunction = async (z, bundle) => {
  const id = String(bundle.inputData.id ?? '').trim();

  // Reading a job needs no API key. The API answers 404 for an unknown ID, which a search reports
  // as finding nothing:
  const response = await z.request({
    skipThrowForStatus: true,
    url: `https://api.speechischeap.com/v2/jobs/${encodeURIComponent(id)}`,
  });

  if (response.status === 404) {
    return [];
  }

  if (response.status >= 400) {
    throw new z.errors.Error(apiErrorMessage(response), 'ApiError', response.status);
  }

  return [describeTranscription(response.data as Job, describeOptionsFor(z, bundle.inputData))];
};

export default {
  key: 'transcription',
  noun: 'Transcription',

  display: {
    description: 'Finds an existing transcription by its Transcription ID.',
    label: 'Find Transcription',
  },

  operation: {
    cleanInputData: false,
    perform,
    sample: transcriptionSample,
    outputFields: transcriptionOutputFields,
    inputFieldGroups: [advancedGroup],

    inputFields: [{
      helpText: 'Enter the ID from an earlier Transcribe Audio step. Speech is Cheap IDs end with -sic.',
      key: 'id',
      label: 'Transcription ID',
      placeholder: '00000000-1111-7222-b333-444444444444-sic',
      required: true,
      type: 'string',
    }, timestampsField, jsonField],
  },
} satisfies Search;
