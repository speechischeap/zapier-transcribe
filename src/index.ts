import { defineApp, version as platformVersion } from 'zapier-platform-core';

import authentication from './authentication';
import { afters, befores } from './middleware';
import packageJson from '../package.json';
import TranscriptionCreate from './creates/transcription';

export default defineApp({
  afterResponse: [...afters],
  authentication,
  beforeRequest: [...befores],
  creates: { [TranscriptionCreate.key]: TranscriptionCreate },
  platformVersion,
  version: packageJson.version,
});
