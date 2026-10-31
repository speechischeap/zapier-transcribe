import type { ZObject } from 'zapier-platform-core';

import { subtitleFile } from '../hydrators';
import { type DescribeOptions, describeTranscription, isTrue, sampleJob } from './jobs';

// Field definitions and samples shared by every step that returns a Transcription, so that
// Transcribe Audio and Find Transcription offer the same fields to later steps.

export const describeOptionsFor = (z: ZObject, inputData: Record<string, unknown>): DescribeOptions => ({
  includeJson: isTrue(inputData.can_include_json),
  subtitleFileFor: (id: string) => z.dehydrateFile(subtitleFile, { id }),
  timestamps: isTrue(inputData.can_include_timestamps),
});

export const timestampsField = {
  default: 'false',
  helpText: 'When enabled, adds a timestamp such as [0:04] to the start of each line in the Transcript.',
  key: 'can_include_timestamps',
  label: 'Include Timestamps in Transcript?',
  type: 'boolean',
} as const;

export const jsonField = {
  default: 'false',
  group: 'advanced',
  helpText: "Override Zapier's default behavior and include the raw JSON response in the output.",
  key: 'can_include_json',
  label: 'Include JSON in Output?',
  type: 'boolean',
} as const;

export const advancedGroup = { emphasize: false, key: 'advanced', label: 'Advanced Options' };

export const transcriptionOutputFields = [
  { key: 'id', label: 'Transcription ID' },
  { key: 'status', label: 'Status' },
  { key: 'text', label: 'Transcript' },
  { key: 'srt', label: 'SRT Subtitles' },
  { key: 'vtt', label: 'VTT Subtitles' },
  { key: 'srt_file', label: 'SRT File', type: 'file' as const },
  { key: 'language', label: 'Detected Language' },
  { key: 'output__duration', label: 'Duration in Seconds', type: 'number' as const },
];

export const transcriptionSample = describeTranscription(
  sampleJob({ labels: false, request: {}, speakers: false, words: false }),
  { includeJson: false, subtitleFileFor: () => 'https://example.com/transcript.srt', timestamps: false },
) as unknown as { [key: string]: unknown };
