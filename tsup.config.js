"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tsup_1 = require("tsup");
exports.default = (0, tsup_1.defineConfig)({
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
//# sourceMappingURL=tsup.config.js.map