# Speech is Cheap: Zapier Transcribe

Zapier integration for the Cloudflare Transcriber

## Develop

1. Bump the version in `package.json`
1. Run `zapier push`
    - Verify that the integration is deployed [on this page](https://developer.zapier.com/)
1. Test the integration on Zapier
    - Start on [the Zaps page](https://zapier.com/app/assets/zaps)
    - Create a new Zap
    - Pick any trigger (e.g., Code » Run JavaScript » `return {};`)
    - Select "Transcribe (`x.y.z`)" » "Transcribe Audio"
    - Add the token and input URL plus any other optional parameters
    - Continue » Test Step

Note that the test will return the `sampleTranscript` object [per these docs](https://github.com/zapier/zapier-platform/blob/afa1140a8e3d4b1b58c557db5c7b810ca0776e3a/packages/cli/README.md#:~:text=performResume%20will%20only%20run%20when%20the%20Zap%20runs%20live%2C%20and%20cannot%20be%20tested%20in%20the%20Zap%20Editor%20when%20configuring%20the%20Zap.).

## Deploy

```sh
zapier push
```
