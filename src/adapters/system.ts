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

export interface BrowserOpener {
  open(url: string, strategy: "system" | "vscode"): Promise<void>;
}

export class VSCodeBrowserOpener implements BrowserOpener {
  async open(url: string, strategy: "system" | "vscode"): Promise<void> {
    if (strategy === "vscode") {
      await vscode.commands.executeCommand("simpleBrowser.show", url);
    } else {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }
  }
}

export interface ConfigurationProvider {
  get<T>(section: string, key: string): T | undefined;
}

export class VSCodeConfigurationProvider implements ConfigurationProvider {
  get<T>(section: string, key: string): T | undefined {
    return vscode.workspace.getConfiguration(section).get<T>(key);
  }
}
