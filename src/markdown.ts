export function generatePRMarkdown(prData: any, diff: string): string {
  return [
    `# #${prData.number} ${prData.title}`,
    `**${prData.author.login}** wants to merge into \`${prData.baseRefName}\` from \`${prData.headRefName}\``,
    `State: **${prData.state}** | [View on GitHub](${prData.url})`,
    "",
    prData.body,
    "",
    "## Diff",
    "```diff",
    diff,
    "```",
  ].join("\n");
}
