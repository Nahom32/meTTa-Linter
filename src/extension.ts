// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('metta');

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "metta-linter" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable =  vscode.workspace.onDidSaveTextDocument(doc => {
            //if (doc.languageId !== 'metta') {return;}

            console.log("Fired!");
            const filePath = doc.fileName;
            const pythonLinterPath = path.join(context.extensionPath, 'linter.py');
            console.log(pythonLinterPath);


            exec(`python3 ${pythonLinterPath} "${filePath}"`, (err, stdout, stderr) => {
                diagnosticCollection.clear();

                if (stderr) {
                    vscode.window.showErrorMessage(stderr);
                    return;
                }

                let diagnostics: vscode.Diagnostic[] = [];

                try {
                    const issues =  JSON.parse(stdout);
                    for (const issue of issues) {
                        const range = new vscode.Range(
                            new vscode.Position(issue.line - 1, issue.column || 0),
                            new vscode.Position(issue.line - 1, (issue.column || 0) + 1)
                        );
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            issue.message,
                            vscode.DiagnosticSeverity.Warning
                        );
                        diagnostics = [...diagnostics,diagnostic];
                    }
                } catch (parseError) {
                    vscode.window.showErrorMessage('Failed to parse linter output.');
                }

                diagnosticCollection.set(doc.uri, diagnostics);
            });
        });

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
