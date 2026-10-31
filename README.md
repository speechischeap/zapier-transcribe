# Speech is Cheap: Zapier Transcribe

Zapier integration for the Cloudflare Transcriber

## Develop

1. Run `pnpm install`, then `pnpm test`
1. Bump the version in `package.json`
1. Run `zapier-platform push`
    - Verify that the integration is deployed [on this page](https://developer.zapier.com/)
    - To try a change without bumping the version, run `zapier-platform push --snapshot <label>` instead. `AGENTS.md` describes how to run a snapshot on Zapier from the terminal
1. Test the integration on Zapier
    - Start on [the Zaps page](https://zapier.com/app/assets/zaps)
    - Create a new Zap
    - Pick any trigger (e.g., Code » Run JavaScript » `return {};`)
    - Select "Speech is Cheap (`x.y.z`)" » "Transcribe Audio"
    - Add the token and an Input URL or Input File, plus any other optional parameters
    - Continue » Test Step

The test step returns a sample transcript without calling the API, so setting up a Zap never bills a transcription. Publish and turn on the Zap to get a real transcript.

## Deploy

```sh
zapier-platform push
```
