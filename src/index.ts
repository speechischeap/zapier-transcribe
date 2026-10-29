import { defineApp, version as platformVersion } from 'zapier-platform-core';

import authentication from './authentication';
import { subtitleFile } from './hydrators';
import { afters, befores } from './middleware';
import packageJson from '../package.json';
import CancelTranscriptionCreate from './creates/cancelTranscription';
import TranscriptionCreate from './creates/transcription';
import TranscriptionSearch from './searches/transcription';

export default defineApp({
  afterResponse: [...afters],
  authentication,
  beforeRequest: [...befores],
  creates: {
    [CancelTranscriptionCreate.key]: CancelTranscriptionCreate,
    [TranscriptionCreate.key]: TranscriptionCreate,
  },
  hydrators: { subtitleFile },
  platformVersion,
  searches: { [TranscriptionSearch.key]: TranscriptionSearch },
  version: packageJson.version,
});
