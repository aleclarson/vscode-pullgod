import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitHubAdapter } from '../adapters/github';

suite('GitHubAdapter Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('GitHubAdapter should be defined', () => {
		const adapter = new GitHubAdapter();
		assert.ok(adapter);
	});
});
