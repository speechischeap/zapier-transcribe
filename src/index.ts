import { defineApp, version as platformVersion } from 'zapier-platform-core';

import authentication from './authentication';
import packageJson from '../package.json';
import TranscriptionCreate from './creates/transcription';

export default defineApp({
  authentication,
  creates: { [TranscriptionCreate.key]: TranscriptionCreate },
  platformVersion,
  version: packageJson.version,
});
