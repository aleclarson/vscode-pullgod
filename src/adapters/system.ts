import * as vscode from "vscode";
import * as cp from "child_process";

export interface Executor {
  exec(command: string, args: string[], cwd: string): Promise<string>;
}

export class NodeExecutor implements Executor {
  exec(command: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cp.execFile(command, args, { cwd }, (error, stdout, stderr) => {
        if (error) {
          reject(stderr || error.message);
          return;
        }
        resolve(stdout.trim());
      });
    });
  }
}

export interface Workspace {
  getWorkspaceFolder(): string | undefined;
}

export class VSCodeWorkspace implements Workspace {
  getWorkspaceFolder(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
}
