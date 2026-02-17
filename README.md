# Pullgod

Pullgod is a VS Code extension that allows you to view and check out pull requests from your current repository using a "stale-while-revalidate" approach for speed and responsiveness.

## Prerequisites

- **GitHub CLI (gh)**: This extension currently uses the `gh` CLI for interacting with GitHub. Ensure it is installed and authenticated. [Install gh](https://cli.github.com/).
- **Git**: Your workspace must be a git repository with a GitHub remote.

## Contributed Commands

- `Pullgod > View Pull Requests`: Lists pull requests from the origin remote.
  - Ordered by newest first (last updated).
  - Searchable/Filterable via the Quick Pick interface.
  - Selecting a PR will pull and check out the branch locally.

## Local Development

### Build Locally

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Compile the extension:
   ```bash
   pnpm run compile
   ```

### Use the self-built extension

1. Open the project in VS Code.
2. Press `F5` to open a new "Extension Development Host" window.
3. In the new window, open a git repository with a GitHub remote.
4. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for `Pullgod > View Pull Requests`.
