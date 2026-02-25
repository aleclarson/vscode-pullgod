import * as vscode from "vscode";

export class MemoryFileSystemProvider implements vscode.FileSystemProvider {
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    this._emitter.event;

  private files = new Map<string, Uint8Array>();

  watch(
    uri: vscode.Uri,
    options: { recursive: boolean; excludes: string[] },
  ): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    if (!this.files.has(uri.path)) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    const content = this.files.get(uri.path)!;
    return {
      type: vscode.FileType.File,
      ctime: Date.now(),
      mtime: Date.now(),
      size: content.length,
    };
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    return [];
  }

  createDirectory(uri: vscode.Uri): void {
    // No-op for flat structure
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const data = this.files.get(uri.path);
    if (!data) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return data;
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean },
  ): void {
    const exists = this.files.has(uri.path);
    if (!exists && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (exists && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }

    this.files.set(uri.path, content);
    this._emitter.fire([
      { type: vscode.FileChangeType.Changed, uri },
    ]);
  }

  delete(uri: vscode.Uri): void {
    if (!this.files.has(uri.path)) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    this.files.delete(uri.path);
    this._emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri },
    ]);
  }

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean },
  ): void {
    const content = this.readFile(oldUri);
    if (!options.overwrite && this.files.has(newUri.path)) {
      throw vscode.FileSystemError.FileExists(newUri);
    }
    this.writeFile(newUri, content, { create: true, overwrite: options.overwrite });
    this.delete(oldUri);
  }
}
