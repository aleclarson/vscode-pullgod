<p align="center">
  <img src="icon.png" width="128" height="128" alt="Pullgod Icon">
</p>

# Pullgod

Pullgod is a VS Code extension that allows you to view and check out pull requests from your current repository using a "stale-while-revalidate" approach for speed and responsiveness.

Available on [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=aleclarson.pullgod) and [OpenVSX](https://open-vsx.org/extension/aleclarson/pullgod).

## Features

- **Blazing Fast**: Uses a local cache to show pull requests instantly while fetching updates in the background.
- **CI Status**: View the build status (success, failure, or pending) for each pull request directly in the list.
- **Open Changes**: Quickly view the git diff for any pull request using the "Open changes" option.
- **Smart Checkout**:
  - Automatically pulls and checks out the PR branch locally.
  - Prevents pulling if the local branch has unpushed commits to avoid accidental conflicts.
  - Integrates with the official "GitHub Pull Requests" extension by focusing its view after checkout.
- **Auto-Update**: Periodically fetches and updates the current branch if it is clean and has no unpushed commits.
- **Copy PR Summary**: Generate and copy a Markdown summary of the PR (including the diff) to your clipboard—perfect for AI-assisted coding or quick reviews.
- **Clear Information**: Shows when each PR was last updated using relative time (e.g., "2 hours ago") and emphasizes PR numbers for easy identification.
- **Priority Management**: Easily mark pull requests as low priority using a multi-select interface.

## Prerequisites

- **GitHub CLI (gh)**: This extension uses the `gh` CLI for interacting with GitHub. Ensure it is installed and authenticated. [Install gh](https://cli.github.com/).
- **Git**: Your workspace must be a git repository with a GitHub remote.

## Contributed Commands

- `Pullgod: View Pull Requests`: Lists pull requests from the origin remote.
  - Ordered by newest first (last updated).
  - Searchable/Filterable via the Quick Pick interface.
  - CI status icons are displayed next to each PR.
  - Selecting a PR will pull and check out the branch locally.
  - Includes an "Open changes" option at the top to quickly view the diff.
- `Pullgod: Copy PR Summary to Clipboard`: Fetches the current PR's metadata and diff, formatting it as Markdown and copying it to the clipboard.
- `Pullgod: Update PR Priorities`: Batch update 'priority:low' labels on pull requests using a multi-select interface.
- `Pullgod: Open PR in Browser`: Opens the current PR on GitHub.
- `Pullgod: Reply to PR`: Opens a temporary text editor to compose and post a comment on the active pull request.

## Local Development

### Build Locally

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Bundle the extension:
   ```bash
   pnpm run bundle
   ```
4. Pack the extension:
   ```bash
   pnpx @vscode/vsce pack --no-dependencies
   ```

### Use the self-built extension

1. Open the project in VS Code.
2. Press `F5` to open a new "Extension Development Host" window.
3. In the new window, open a git repository with a GitHub remote.
4. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for `Pullgod: View Pull Requests`.
