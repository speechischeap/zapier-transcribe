import type {
  Create,
  PerformFunction,
} from 'zapier-platform-core';

import {
  describeTranscription,
  type Job,
  sampleJob,
} from '../lib/jobs';

// Settings that shape the Zap step's output but mean nothing to the Jobs API:
const OUTPUT_OPTIONS = ['can_include_json', 'can_include_timestamps'];

// Failure messages from https://docs.speechischeap.com/errors/ that the same input would always trigger again:
const PERMANENT_FAILURES = [
  /^Expected at least [\d.]+ seconds/,
  /^Expected at most [\d.]+ seconds/,
  /does not appear in the list of supported languages/,
  /^'minimum_confidence' must be between/,
];

const describeOptions = (inputData: Record<string, unknown>) => ({
  includeJson: Boolean(inputData.can_include_json),
  timestamps: Boolean(inputData.can_include_timestamps),
});

const perform: PerformFunction = async (z, bundle) => {
  const payload: typeof bundle.inputData = { ...bundle.inputData };

  for (const option of OUTPUT_OPTIONS) {
    delete payload[option];
  }

  // Validate payload:
  const validationErrors: string[] = [];

  if (payload.segment_duration < 6 || payload.segment_duration > 30) {
    validationErrors.push('- Segment duration must be between 6 and 30 seconds (inclusive).');
  }

  if (payload.minimum_confidence < 0 || payload.minimum_confidence > 1) {
    validationErrors.push('- Minimum confidence must be between 0.0 and 1.0 (inclusive).');
  }

  if (validationErrors.length) {
    throw new z.errors.Error(validationErrors.join('\n'), 'TranscriptionConfigurationError', 400);
  }

  if (bundle.meta.isLoadingSample) {
    const job = sampleJob({
      labels: Boolean(payload.can_label_audio),
      request: payload,
      speakers: Boolean(payload.can_parse_speakers),
      words: Boolean(payload.can_parse_words),
    });

    return describeTranscription(job, describeOptions(bundle.inputData));
  }

  payload.webhook_url = z.generateCallbackUrl();

  const apiResponse = await z.request({
    body: payload,
    method: 'POST',
    url: 'https://api.speechischeap.com/v2/jobs/',
  });

  if (apiResponse.status !== 202) {
    const message = apiResponse.data?.error || `API returned status ${apiResponse.status}`;

    throw new z.errors.Error(message, 'TranscriptionError', apiResponse.status);
  }

  const jobData = apiResponse.data as Job;

  if (!jobData || !jobData.id) {
    throw new z.errors.Error('Transcription job initiated, but no job ID was returned.', 'JobCreationError', 500);
  }

  return jobData;
};

const performResume: PerformFunction = async (z, bundle) => {
  const job = bundle.cleanedRequest as Job;
  const { status } = job;

  if (status === 'COMPLETED') {
    return describeTranscription(job, describeOptions(bundle.inputData));
  }

  if (status === 'FAILED') {
    const message = job.output?.error || 'Transcription job failed with an unknown error';

    // A permanent failure would fail again with the same input, so halt instead of letting Autoreplay resend it:
    if (PERMANENT_FAILURES.some((pattern) => pattern.test(message))) {
      throw new z.errors.HaltedError(message);
    }

    throw new z.errors.Error(message, 'TranscriptionError', 400);
  }

  // Someone canceled the transcription on purpose, so a replay would only undo their decision:
  if (status === 'CANCELED') {
    throw new z.errors.HaltedError('The transcription was canceled before it finished.');
  }

  throw new z.errors.Error(`Received unexpected job status from webhook: ${status}`, 'WebhookError', 400);
};

export default {
  key: 'transcription',
  noun: 'Transcription',

  display: {
    description: 'Creates a new transcription from an audio or video file.',
    label: 'Transcribe Audio',
  },

  operation: {
    perform,
    performResume,
    sample: describeTranscription(
      sampleJob({ labels: false, request: {}, speakers: false, words: false }),
      { includeJson: false, timestamps: false },
    ) as unknown as { [k: string]: unknown },

    outputFields: [
      { key: 'id', label: 'Transcription ID' },
      { key: 'status', label: 'Status' },
      { key: 'text', label: 'Transcript' },
      { key: 'language', label: 'Detected Language' },
      { key: 'output__duration', label: 'Duration in Seconds', type: 'number' },
    ],

    inputFields: [{
      helpText: "The input URL depends on where the file is stored. Please [see the docs](https://docs.speechischeap.com/integrations/zapier) if you need additional help.",
      key: 'copy',
      type: 'copy',
    }, {
      helpText: 'Input URL of the audio file to transcribe.',
      key: 'input_url',
      label: 'Input URL',
      placeholder: 'https://example.com/audio.mp3',
      required: true,
      type: 'string',
    }, {
      default: 'false',
      helpText: "When enabled, adds `speaker_id` to each segment based on the speaker's voice. See [add-ons](https://speechischeap.com/#addons) for pricing.",
      key: 'can_parse_speakers',
      label: 'Can Parse Speakers?',
      type: 'boolean',
    }, {
      default: 'false',
      helpText: "When enabled, includes a timecode for every word in the transcription. See [add-ons](https://speechischeap.com/#addons) for pricing.",
      key: 'can_parse_words',
      label: 'Can Parse Words?',
      type: 'boolean',
    }, {
      default: 'false',
      helpText: "When enabled, includes an audio classification label in the transcription. See [add-ons](https://speechischeap.com/#addons) for pricing.",
      key: 'can_label_audio',
      label: 'Can Label Audio?',
      type: 'boolean',
    }, {
      default: 'false',
      helpText: 'When enabled, adds a timestamp such as [0:04] to the start of each line in the Transcript.',
      key: 'can_include_timestamps',
      label: 'Include Timestamps in Transcript?',
      type: 'boolean',
    }, {
      default: '0.5',
      helpText: "Filter out segments that fall below this confidence threshold. Applies both to transcriptions and to non-speech audio labels when `can_label_audio` is `true`.",
      key: 'minimum_confidence',
      label: 'Minimum Confidence Threshold (0.0 - 1.0)',
      type: 'number',
    }, {
      default: '30',
      helpText: 'Duration of each transcription segment in seconds. Must be between six and 30 seconds.',
      key: 'segment_duration',
      label: 'Segment Duration in Seconds (6 - 30)',
      type: 'integer',
    }, {
      default: 'false',
      helpText: "Override Zapier's default behavior and include the raw JSON response in the output.",
      key: 'can_include_json',
      label: 'Include JSON in Output?',
      type: 'boolean',
    }],
  },
} satisfies Create;
