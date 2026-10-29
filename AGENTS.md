# Agent guide

This repo is the public Zapier integration "Speech is Cheap" (Zapier app `App224577`). It exposes the Speech is Cheap Jobs API v2 to Zapier users. The domain vocabulary lives in `CONTEXT.md`; use its terms in code, copy, and commits.

## Ground rules

- Never push a semantic version (`x.y.z`), promote, migrate, or deprecate on Zapier without the user's explicit approval. Snapshot versions (`0.0.0-LABEL`) are fine for testing; only the integration team can see them.
- Removing or renaming an input or output key, changing an input field's type, or making an optional input required is a breaking change. Zapier blocks promotion of such changes without a major version bump. Add new keys instead.
- `performResume` must keep handling callbacks for runs that started on an older version, because migrated Zaps can resume on new code.
- The repo is public. Keep secrets, connection IDs, and customer data out of it.

## Workflow

- HubFlow: branch `feature/*` off `develop` with `git hf feature start <name>`, open a PR into `develop`, merge with a merge commit, then `git hf feature finish <name>`. Releases go through `release/*` into `master`.
- One problem per PR and one commit per PR.
- Keep `CHANGELOG.md` entries short; put the full context in the commit message.
- Use `pnpm`. `zapier-platform` is the CLI binary (the old `zapier` binary is gone since 19.0.0).

## Checks

- `pnpm test` builds with `tsc`, then runs Vitest. `zapier-platform test` runs the same script.
- Tests live in `src/test/` and stay out of `dist`. Use `nock` to intercept `z.request`. The app tester omits `bundle.meta`, so pass it the way production sends it.
- `zapier-platform validate` runs Zapier's integration checks. Fix new errors and publishing tasks; read new warnings.

## End-to-end testing on Zapier

Remote invokes run the pushed code on Zapier's servers with a real connection, so they bill real transcription minutes. Keep test spend small and use the test Audio below.

1. `zapier-platform push --snapshot <label>` (12 characters or fewer). Re-pushing the same label replaces that version.
2. `zapier-platform invoke -r -v 0.0.0-<label> -a <connection-id> create transcription --non-interactive -i '<json>'`. Find the connection ID by running `zapier-platform invoke -r auth test` in a terminal, which lists the admin account's connections.
3. A callback action returns `"status": "delayed"` as soon as `perform` creates the job. When the API's webhook arrives, Zapier runs `performResume`. Read its input and output with `zapier-platform logs --type bundle --version 0.0.0-<label> --format json`. The `Input` column is cut off at about 3,500 characters. A step that throws, including a `HaltedError`, leaves no bundle entry; its error appears in `zapier-platform logs --type console --version 0.0.0-<label>`.
4. `zapier-platform logs --type http --version 0.0.0-<label>` shows outgoing requests.
5. `--isLoadingSample` has no effect in remote mode; the call runs a real job. Check the Sample locally instead: put `authData_token=<anything>` in a temporary `.env`, run `zapier-platform invoke create transcription --isLoadingSample -i '<json>'`, then delete `.env`. Local mode wants every input value as a string, such as `"true"`.
6. Large outputs, such as a 20-minute Transcript, show as empty in the bundle log. `GET https://api.speechischeap.com/v2/jobs/<id>` needs no key, so fetch the job and run the code in `dist/` on it instead.
7. Delete finished snapshots with `zapier-platform delete version 0.0.0-<label>`.

Test Audio on `https://cdn.speechischeap.com/`:

| File | Use |
| --- | --- |
| `train-2s.mp3`, `train-5s.mp3` | Shorter than six seconds; the Zap should halt |
| `shap-grok-25s.mp3` | 25 seconds of speech; the default smoke test |
| `polyglot-cut.mp3` | Several languages |
| `split2ch.mp3` | Two-channel audio for Split channels |
| `silence.wav` | No speech |
| `podcast-sic-api-01.m4a` | About 20 minutes |
| `starship8.mp3` | About one hour |

Never use `little-women.m4a`; it is close to 24 hours and only for stress tests.

## Jobs API facts that shape the code

- Docs: https://docs.speechischeap.com/jobs-v2/ and the changelog at https://docs.speechischeap.com/jobs-v2/changelog/.
- The API ignores request fields it does not know, so removed inputs do not break older Zaps.
- Error bodies are plain text, not JSON.
- The webhook makes one attempt with no retry and no signature. `GET /v2/jobs/:id` needs no API key, and for a failed job it does not include the reason; only the webhook does.
- The API has no full-text field. The Transcript and Subtitles are built from `output.segments`.
