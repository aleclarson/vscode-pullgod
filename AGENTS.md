# Agent Instructions

- Maintain the `CHANGELOG.md` file as changes are made.
  - Ensure the version heading reflects the next logical version number (e.g., `## [1.7.2]`), rather than using "Unreleased".
  - Do not add changes to a version that already has a release date (e.g., `## [1.7.1] - 2026-02-22`).
  - When adding a new version heading, do not include a release date.
  - When adding to an unreleased version, check if you need to bump it (e.g., a patch version `1.0.1` should be bumped to `1.1.0` if you are adding a new feature).
- Keep the `README.md` file up-to-date after any user-facing changes (new commands, features, settings, etc.).
- A GitHub workflow enforces that `CHANGELOG.md` is modified in every Pull Request.
