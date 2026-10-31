import type { PerformFunction, Search } from 'zapier-platform-core';

import {
  advancedGroup,
  describeOptionsFor,
  jsonField,
  timestampsField,
  transcriptionOutputFields,
  transcriptionSample,
} from '../lib/fields';
import { describeTranscription, SAMPLE_JOB_ID, sampleJob } from '../lib/jobs';
import { jobFrom } from '../lib/read';

const perform: PerformFunction = async (z, bundle) => {
  const id = String(bundle.inputData.id ?? '').trim();

  // The Zap editor maps the Sample's ID from Transcribe Audio while a user sets up this step:
  if (id === SAMPLE_JOB_ID) {
    const sample = sampleJob({ labels: false, request: {}, speakers: false, words: false });

    return [describeTranscription(sample, describeOptionsFor(z, bundle.inputData))];
  }

  // Reading a job needs no API key. The API answers 404 for an unknown ID, which a search reports
  // as finding nothing:
  const response = await z.request({
    skipThrowForStatus: true,
    url: `https://api.speechischeap.com/v2/jobs/${encodeURIComponent(id)}`,
  });

  if (response.status === 404) {
    return [];
  }

  return [describeTranscription(jobFrom(z, response), describeOptionsFor(z, bundle.inputData))];
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
