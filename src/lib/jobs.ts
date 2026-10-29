import { buildSubtitles, buildTranscript, dominantLanguage } from './transcript';

// Shapes of the Jobs API v2, from https://docs.speechischeap.com/jobs-v2/output/

export type JobStatus = 'CANCELED' | 'COMPLETED' | 'FAILED' | 'PENDING';

export interface Word {
  end: number;
  start: number;
  text: string;
}

export interface Segment {
  confidence: number;
  end: number;
  id: number;
  label?: string;
  language: string | null;
  processing_duration_in_s: number;
  speaker_id?: string;
  start: number;
  text: string;
  words: Word[] | null;
}

export interface JobOutput {
  duration?: number;
  error?: string;
  request?: Record<string, unknown>;
  segments?: Segment[];
}

export interface Job {
  id: string;
  output: JobOutput;
  status: JobStatus;
}

// What a Zap step returns for a Transcription: the job plus the results built from its Segments.
export interface Transcription extends Job {
  json?: string;
  language: string | null;
  srt: string;
  srt_file?: string;
  text: string;
  vtt: string;
}

export interface DescribeOptions {
  includeJson: boolean;
  // Returns a file pointer for the SRT Subtitles; omitted where no file can be offered.
  subtitleFileFor?: (id: string) => string;
  timestamps: boolean;
}

export const describeTranscription = (
  job: Job,
  { includeJson, subtitleFileFor, timestamps }: DescribeOptions,
): Transcription => {
  const segments = job.output?.segments ?? [];
  const srt = buildSubtitles(segments, 'srt');

  return {
    id: job.id,
    status: job.status,
    text: buildTranscript(segments, { timestamps }),
    srt,
    vtt: buildSubtitles(segments, 'vtt'),
    ...(subtitleFileFor ? { srt_file: srt ? subtitleFileFor(job.id) : '' } : {}),
    language: dominantLanguage(segments),
    output: job.output ?? {},
    // The job as the API sent it, without the `querystring` Zapier adds to callbacks:
    ...(includeJson ? { json: JSON.stringify({ id: job.id, output: job.output, status: job.status }) } : {}),
  };
};

export const SAMPLE_JOB_ID = '00000000-1111-7222-b333-444444444444-sic';

export const SAMPLE_TEXT = 'SAMPLE. Publish and run your Zap to generate a real transcript.';

// The settings the API echoes back in `output.request`, at their defaults:
export const SAMPLE_REQUEST: Record<string, unknown> = {
  can_label_audio: false,
  can_parse_speakers: false,
  can_parse_words: false,
  can_stream_output: false,
  input_url: 'https://example.com/audio.mp3',
  is_split_channel: false,
  language: null,
  minimum_confidence: 0.5,
  segment_duration: 30,
};

export interface SampleOptions {
  labels: boolean;
  request: Record<string, unknown>;
  speakers: boolean;
  words: boolean;
}

// The Zap editor shows this while a user sets up a step. It mirrors the add-ons they picked.
export const sampleJob = ({ labels, request, speakers, words }: SampleOptions): Job => ({
  id: SAMPLE_JOB_ID,
  status: 'COMPLETED',
  output: {
    duration: 13,
    request: { ...SAMPLE_REQUEST, ...request },
    segments: [{
      confidence: 1,
      end: 12.345,
      id: 1,
      ...(labels ? { label: 'speech' } : {}),
      language: 'en (99.95%)',
      processing_duration_in_s: 0.321,
      ...(speakers ? { speaker_id: 'A' } : {}),
      start: 1.234,
      text: SAMPLE_TEXT,
      words: words ? [{ end: 1.345, start: 1.234, text: 'SAMPLE.' }] : [],
    }],
  },
});
