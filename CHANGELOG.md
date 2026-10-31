# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-31

### Added

- Input File for files from earlier steps, such as Google Drive
- Transcript with optional timestamps, and Detected Language
- SRT and VTT Subtitles, plus an SRT File for later steps
- Language, Split Channels, and Keep Transcription Private inputs
- Find Transcription search
- Cancel Transcription action

### Removed

- **BREAKING**: Hotwords and Prompt inputs, dropped by Jobs API 2.8.0

### Fixed

- Read mapped yes/no values such as "Yes" or "1"
- Show the API's error message instead of a JSON dump
- Halt the Zap for audio over 24 hours and other permanent failures

## [1.2.0] - 2026-10-27

### Changed

- Run on Node.js 22 by upgrading `zapier-platform-core` to 19.2.1

### Fixed

- Halt the Zap instead of failing it when the audio is shorter than six seconds, so Autoreplay doesn't resend it

## [1.1.0] - 2025-05-15

### Added

- Authentication mechanism as required by Zapier

### Changed

- Sample transcript text to make it more clear that it's a sample

## [1.0.1] - 2025-05-12

### Fixed

- Use valid markdown in the token help text URL

## [1.0.0] - 2025-05-12

### Added

- Transcribe action
