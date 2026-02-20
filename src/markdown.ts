export function generatePRMarkdown(prData: any, diff: string): string {
  return [
    `# #${prData.number} ${prData.title}`,
    "",
    prData.body,
    "",
    "```diff",
    diff,
    "```",
  ].join("\n");
}
