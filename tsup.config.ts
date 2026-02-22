import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  external: ["vscode"],
  minify: true,
  sourcemap: true,
  clean: false, // Don't clean out directory as tests might be there
  outDir: "out",
  target: "es2020",
  noExternal: ["octokit"], // Bundle dependencies like octokit
});
