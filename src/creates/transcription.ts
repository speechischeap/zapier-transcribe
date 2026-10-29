import type {
  Create,
  HttpResponse,
  PerformFunction,
} from 'zapier-platform-core';

interface TranscriptionJob {
  id: string;
  json?: string;
  output: TranscriptionOutputOnError | TranscriptionOutputOnSuccess;
  querystring?: object;
  status: 'CANCELED' | 'COMPLETED' | 'FAILED';
}

interface TranscriptionOutputOnError {
  error: string;
  request: object;
}

interface TranscriptionOutputOnSuccess {
  request: object;
  segments: Array<{
    confidence: number;
    end: number;
    id: number;
    label?: string;
    language: string;
    processing_duration_in_s: number;
    seek: number;
    speaker_id?: string;
    start: number;
    text: string;
    words: any[] | null;
  }>
}

const sampleTranscript: TranscriptionJob = {
  id: '00000000-1111-7222-b333-444444444444-sic',
  status: 'COMPLETED',
  output: {
    request: {
      can_label_audio: false,
      can_parse_speakers: false,
      can_parse_words: false,
      input_url: '',
      language: null,
      minimum_confidence: 0.5,
      segment_duration: 30
    },

    segments: [
      {
        confidence: 1.000,
        end: 12.345,
        id: 1,
        language: 'en (99.95%)',
        processing_duration_in_s: 0.321,
        seek: 1234.5,
        start: 1.234,
        text: 'SAMPLE. Publish Zap for the real transcription.',
        words: null
      }
    ]
  },
}

const sampleTranscriptWords = [{
  end: 1.345,
  text: 'SAMPLE.',
  start: 1.234,
}];

// Failure messages from https://docs.speechischeap.com/errors/ that the same input would always trigger again:
const PERMANENT_FAILURES = [
  /^Expected at least [\d.]+ seconds/,
  /^Expected at most [\d.]+ seconds/,
  /does not appear in the list of supported languages/,
  /^'minimum_confidence' must be between/,
];

const perform: PerformFunction = async (z, bundle) => {
  let apiResponse: HttpResponse<any>;

  const payload: typeof bundle.inputData = { ...bundle.inputData };

  // Remove unexpected fields from the API payload:
  delete payload.can_include_json;

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

  sampleTranscript.output.request = payload;

  if (bundle.meta.isLoadingSample) {
    const successfulOutput = sampleTranscript.output as TranscriptionOutputOnSuccess;

    if (successfulOutput.segments && successfulOutput.segments[0]) {
      const firstSegment = successfulOutput.segments[0];

      firstSegment.label = bundle.inputData.can_label_audio ? 'speech' : undefined;
      firstSegment.speaker_id = bundle.inputData.can_parse_speakers ? 'A' : undefined;
      firstSegment.words = bundle.inputData.can_parse_words ? sampleTranscriptWords : null;
    }

    sampleTranscript.json = bundle.inputData.can_include_json ? JSON.stringify(sampleTranscript) : undefined;

    return sampleTranscript;
  }

  payload.webhook_url = z.generateCallbackUrl();

  try {
    apiResponse = await z.request({
      body: payload,
      headers: { Authorization: `Bearer ${bundle.authData.token}` },
      method: 'POST',
      url: 'https://api.speechischeap.com/v2/jobs/',
    });
  } catch (error: any) {
    const message = error.message || 'Failed to start a transcription job';

    throw new z.errors.Error(message, 'TranscriptionError', 400);
  }

  if (apiResponse.status !== 202) {
    const message = apiResponse.data?.error || `API returned status ${apiResponse.status}`;

    throw new z.errors.Error(message, 'TranscriptionError', apiResponse.status);
  }

  const jobData = apiResponse.data as TranscriptionJob;

  if (!jobData || !jobData.id) {
    throw new z.errors.Error('Transcription job initiated, but no job ID was returned.', 'JobCreationError', 500);
  }

  return jobData;
};

const performResume: PerformFunction = async (z, bundle) => {
  const finalJobResponse = bundle.cleanedRequest as TranscriptionJob;

  delete finalJobResponse.querystring;

  const { status } = finalJobResponse;

  if (status === 'COMPLETED') {
    finalJobResponse.json = bundle.inputData.can_include_json ? JSON.stringify(finalJobResponse) : undefined;

    return finalJobResponse;
  }

  if (status === 'FAILED') {
    const message = (finalJobResponse.output as TranscriptionOutputOnError)?.error || 'Transcription job failed with an unknown error';

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
    description: 'Creates a new audio transcription',
    label: 'Transcribe Audio',
  },

  operation: {
    perform,
    performResume,
    sample: sampleTranscript as unknown as { [k: string]: unknown; },

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
