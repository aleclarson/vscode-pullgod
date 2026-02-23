# Change Log

All notable changes to the "pullgod" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.8.1]

### Internal

- Refactored command handlers into separate modules in `src/commands/` for better maintainability.

## [1.8.0] - 2026-02-23

### Added

- Display "commits behind" count with an icon in the PR Quick Pick list for locally checked out branches.
- Hide PRs with `priority:low` label by default and provide a "View low priority PRs" option in the Quick Pick list.

### Changed

- Updated PR sorting logic: prioritize recently checked-out PRs, then recently created ones.

## [1.7.1] - 2026-02-22

### Fixed

- Included `node_modules` in the packaged extension to fix missing runtime dependencies.

## [1.7.0] - 2026-02-21

### Added

- Periodically fetch and update the current branch if clean and safe.
- `Pullgod: Update PR Priorities` command to batch manage `priority:low` labels on pull requests.

## [1.6.0] - 2026-02-20

### Added

- Selection-preserving updates for the pull request list, maintaining scroll position and active selection during background refreshes.

## [1.5.0] - 2026-02-20

### Added

- CI status icons in the Quick Pick list.
- `Pullgod: Copy PR Summary to Clipboard` command (replaces auto-opening PR markdown).

### Changed

- Always show "Open changes" in Quick Pick with an optimized branch check.

## [1.4.0] - 2026-02-19

### Added

- "Open changes for current PR" option in the Quick Pick list.
- Per-workspace pull request caching for improved performance and isolation.
- OpenVSX publishing support.

### Changed

- Improved Quick Pick display with relative time (e.g., "2 hours ago") instead of absolute timestamps.
- Automatically focus the GitHub extension's active pull request view after checkout.

## [1.3.0] - 2026-02-19

### Changed

- Emphasize pull request numbers in the QuickPick list.

## [1.2.0] - 2026-02-19

### Added

- Local filesystem caching for the pull request list.
- Prevent pull during PR checkout if the local branch has unpushed commits.

## [1.1.0] - 2026-02-17

### Added

- Enhanced diff view with pull request metadata and Markdown formatting.
- Enhanced "Open in Browser" to support the current branch context.
- Open diff view automatically after checking out a PR.

### Fixed

- Make diff view readonly and add the "Open in Browser" action to the editor title menu.

## [1.0.0] - 2026-02-17

- Initial release
