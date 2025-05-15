import type { App } from 'zapier-platform-core';
import { version as platformVersion } from 'zapier-platform-core';

import authentication from './authentication';
import packageJson from '../package.json';
import TranscriptionCreate from './creates/transcription';

export default {
  authentication,
  creates: { [TranscriptionCreate.key]: TranscriptionCreate },
  platformVersion,
  version: packageJson.version,
} satisfies App;
