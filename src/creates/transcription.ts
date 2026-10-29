import type {
  Create,
  PerformFunction,
} from 'zapier-platform-core';

import {
  advancedGroup,
  describeOptionsFor,
  jsonField,
  timestampsField,
  transcriptionOutputFields,
  transcriptionSample,
} from '../lib/fields';
import { fileToInputUrl } from '../lib/files';
import {
  buildJobRequest,
  describeTranscription,
  type Job,
  sampleJob,
} from '../lib/jobs';
import { LANGUAGES } from '../lib/languages';

// Failure messages from https://docs.speechischeap.com/errors/ that the same input would always trigger again:
const PERMANENT_FAILURES = [
  /^Expected at least [\d.]+ seconds/,
  /^Expected at most [\d.]+ seconds/,
  /does not appear in the list of supported languages/,
  /^'minimum_confidence' must be between/,
];

const perform: PerformFunction = async (z, bundle) => {
  const { errors, request } = buildJobRequest(bundle.inputData);

  if (errors.length) {
    throw new z.errors.Error(errors.join('\n'), 'TranscriptionConfigurationError', 400);
  }

  if (bundle.meta.isLoadingSample) {
    const job = sampleJob({
      labels: Boolean(request.can_label_audio),
      request,
      speakers: Boolean(request.can_parse_speakers || request.is_split_channel),
      words: Boolean(request.can_parse_words),
    });

    return describeTranscription(job, describeOptionsFor(z, bundle.inputData));
  }

  if (bundle.inputData.input_file) {
    request.input_url = await fileToInputUrl(z, String(bundle.inputData.input_file));
  }

  const apiResponse = await z.request({
    body: { ...request, webhook_url: z.generateCallbackUrl() },
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
    return describeTranscription(job, describeOptionsFor(z, bundle.inputData));
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
    // `buildJobRequest` drops blank fields itself, so Zapier need not clean them (check D028):
    cleanInputData: false,
    perform,
    performResume,
    sample: transcriptionSample,
    outputFields: transcriptionOutputFields,

    inputFieldGroups: [advancedGroup],

    inputFields: [{
      helpText: 'Provide either a public file URL or a file from an earlier step. Exactly one input is required. Very long recordings work best through Input URL. For setup details, see the [documentation](https://docs.speechischeap.com/zapier/overview/).',
      key: 'copy',
      type: 'copy',
    }, {
      // Optional since 2.0.0, when Input File became the alternative. Never change its type.
      helpText: 'Enter a direct download URL for an audio or video file that downloads without a login. Leave blank if you use Input File.',
      key: 'input_url',
      label: 'Input URL',
      placeholder: 'https://example.com/audio.mp3',
      required: false,
      type: 'string',
    }, {
      helpText: 'Select an audio or video file from an earlier step such as Google Drive or Dropbox. Files can be up to 150 MB. Leave blank if you use Input URL.',
      key: 'input_file',
      label: 'Input File',
      required: false,
      type: 'file',
    }, {
      choices: LANGUAGES,
      helpText: 'Select one of 100 languages to apply it to all segments. Leave blank to detect language automatically for each segment.',
      key: 'language',
      label: 'Language',
      required: false,
      type: 'string',
    }, {
      default: 'false',
      helpText: 'When enabled, identifies speakers by voice, adds speaker IDs to segments, and labels speakers like Speaker A in the Transcript and Subtitles. See [add-ons](https://speechischeap.com/#addons) for pricing.',
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
      helpText: 'When enabled, tags non-speech sounds like music in the Transcript and Subtitles. Silence is omitted. See [add-ons](https://speechischeap.com/#addons) for pricing.',
      key: 'can_label_audio',
      label: 'Can Label Audio?',
      type: 'boolean',
    }, timestampsField, {
      default: 'false',
      group: 'advanced',
      helpText: 'When enabled, treats each audio channel as its own speaker, such as in a stereo call recording. Works without speaker parsing.',
      key: 'is_split_channel',
      label: 'Split Channels?',
      type: 'boolean',
    }, {
      default: 'false',
      group: 'advanced',
      helpText: "When enabled, hides the input URL and deletes the transcript from Speech is Cheap's servers 12 hours after completion. Your Zap step still receives the full result.",
      key: 'is_private',
      label: 'Keep Transcription Private?',
      type: 'boolean',
    }, {
      default: '0.5',
      group: 'advanced',
      helpText: "Filter out segments that fall below this confidence threshold. Applies both to transcriptions and to non-speech audio labels when `can_label_audio` is `true`.",
      key: 'minimum_confidence',
      label: 'Minimum Confidence Threshold (0.0 - 1.0)',
      type: 'number',
    }, {
      default: '30',
      group: 'advanced',
      helpText: 'Duration of each transcription segment in seconds. Must be between six and 30 seconds.',
      key: 'segment_duration',
      label: 'Segment Duration in Seconds (6 - 30)',
      type: 'integer',
    }, jsonField],
  },
} satisfies Create;
