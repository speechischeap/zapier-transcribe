# Speech is Cheap on Zapier

The public Zapier integration for Speech is Cheap. It lets Zapier users transcribe audio files with the Speech is Cheap Jobs API and use the results in later Zap steps.

## Language

### Transcribing

**Audio**:
The audio or video file a user wants transcribed, supplied as a public URL or a Zapier file.
_Avoid_: Media, recording

**Transcription**:
One run of the Jobs API on one Audio, as Zapier users see it.
_Avoid_: Job (the API's name, fine in API code), task (Zapier's billing unit)

**Transcription ID**:
The identifier the API assigns to a Transcription, ending in `-sic`.
_Avoid_: Job ID in user-facing copy

**Private transcription**:
A Transcription whose input URL Speech is Cheap redacts and whose Segments it deletes 12 hours after completion.

**Permanent failure**:
A failed Transcription that would fail again with the same input, such as Audio shorter than six seconds. The Zap halts instead of retrying.
_Avoid_: Fatal error

**Sample**:
The placeholder Transcription the Zap editor shows while a user sets up the step. No Audio is transcribed.
_Avoid_: Test transcription

### Results

**Segment**:
A timed slice of a Transcription with its own text, confidence, and language, plus a Speaker, Audio label, or word timings when requested.
_Avoid_: Line item, chunk

**Transcript**:
The text of a completed Transcription, assembled from its Segments.
_Avoid_: Transcription (for the text itself)

**Subtitles**:
The Transcript as timed cues in SRT or VTT format.
_Avoid_: Captions

**Speaker**:
The voice a Segment is attributed to, named `A`, `B`, and so on.
_Avoid_: Speaker label

**Audio label**:
The kind of sound in a Segment, such as `speech`, `music`, or `silence`.
_Avoid_: Tag, class

### Options and billing

**Add-on**:
A paid option billed per audio minute on top of transcription: Speaker parsing, word timings, or Audio labels.
_Avoid_: Feature, extra

**Split channels**:
An option that treats each audio channel as its own Speaker, as in a stereo call recording.

**Connection**:
A Zapier user's saved Speech is Cheap API key.
_Avoid_: Account, auth
