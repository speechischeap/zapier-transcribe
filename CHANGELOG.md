# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- **BREAKING**: Hotwords and Prompt inputs, which the Jobs API dropped in 2.8.0

### Fixed

- Halt the Zap instead of failing it when the audio is over 24 hours, the language is unsupported, the confidence threshold is out of range, or someone canceled the transcription

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
