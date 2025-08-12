// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { exec } from "child_process";
import * as path from "path";
import * as fs from "fs";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("metta");

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "metta-linter" is now active!');

  function checkLinterExists(linterPath: string): boolean {
    try {
      return fs.existsSync(linterPath);
    } catch (error) {
      console.error("Error checking linter path:", error);
      return false;
    }
  }

  function runLinter(document: vscode.TextDocument) {
    const filePath = document.fileName;
    const pythonLinterPath = path.join(context.extensionPath, "linter.py");

    if (!checkLinterExists(pythonLinterPath)) {
      vscode.window.showErrorMessage(`MeTTa linter script not found at: ${pythonLinterPath}`);
      return;
    }

    console.log("Running MeTTa linter on:", filePath);
    console.log("Linter path:", pythonLinterPath);

    const command = `python3 "${pythonLinterPath}" "${filePath}"`;
    const execOptions = {
      timeout: 30000, // 30 second timeout
      cwd: context.extensionPath,
    };

    exec(command, execOptions, (err, stdout, stderr) => {
      diagnosticCollection.delete(document.uri);

      if (err) {
        console.error("Linter execution error:", err);
        vscode.window.showErrorMessage(`MeTTa linter failed: ${err.message}`);
        return;
      }

      if (stderr) {
        console.warn("Linter stderr:", stderr);
        if (stderr.includes("Error") || stderr.includes("Exception")) {
          vscode.window.showErrorMessage(`MeTTa linter error: ${stderr}`);
          return;
        }
      }

      if (!stdout.trim()) {
        console.log("No linting issues found");
        return;
      }

      const diagnostics: vscode.Diagnostic[] = [];

      try {
        const issues = JSON.parse(stdout);

        if (!Array.isArray(issues)) {
          throw new Error("Linter output is not an array");
        }

        for (const issue of issues) {
          if (!issue.line || !issue.message) {
            console.warn("Invalid issue format:", issue);
            continue;
          }

          const line = Math.max(0, issue.line - 1);
          const startColumn = Math.max(0, issue.column || 0);
          const endColumn = issue.endColumn || startColumn + (issue.length || 1);

          const range = new vscode.Range(new vscode.Position(line, startColumn), new vscode.Position(line, endColumn));

          let severity = vscode.DiagnosticSeverity.Warning;
          if (issue.severity === "error") {
            severity = vscode.DiagnosticSeverity.Error;
          } else if (issue.severity === "info") {
            severity = vscode.DiagnosticSeverity.Information;
          }

          const diagnostic = new vscode.Diagnostic(range, issue.message, severity);

          diagnostic.source = "metta-linter";
          if (issue.code) {
            diagnostic.code = issue.code;
          }

          diagnostics.push(diagnostic);
        }

        console.log(`Found ${diagnostics.length} MeTTa linting issues`);
      } catch (parseError) {
        console.error("Failed to parse linter output:", parseError);
        console.error("Raw output:", stdout);
        vscode.window.showErrorMessage(`Failed to parse MeTTa linter output: ${parseError}`);
        return;
      }

      diagnosticCollection.set(document.uri, diagnostics);
    });
  }
  async function lintAllMettaFiles() {
    if (!vscode.workspace.workspaceFolders) {
      console.log("No workspace folders found");
      return;
    }

    console.log("Scanning for existing .metta files...");

    try {
      const mettaFiles = await vscode.workspace.findFiles("**/*.metta", "**/node_modules/**");
      console.log(`Found ${mettaFiles.length} .metta files`);

      for (const fileUri of mettaFiles) {
        try {
          const document = await vscode.workspace.openTextDocument(fileUri);
          console.log(`Linting existing file: ${document.fileName}`);
          runLinter(document);
        } catch (error) {
          console.error(`Failed to open document ${fileUri.fsPath}:`, error);
        }
      }
    } catch (error) {
      console.error("Error finding .metta files:", error);
      vscode.window.showErrorMessage(`Failed to scan for .metta files: ${error}`);
    }
  }
    await lintAllMettaFiles();
  const disposable = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.languageId !== "metta" && !doc.fileName.endsWith(".metta")) {
      return;
    }

    console.log("MeTTa file saved, running linter!");
    runLinter(doc);
  });

  const lintCommand = vscode.commands.registerCommand("metta-linter.lint", () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage("No active editor found");
      return;
    }

    if (activeEditor.document.languageId !== "metta" && !activeEditor.document.fileName.endsWith(".metta")) {
      vscode.window.showWarningMessage("Current file is not a MeTTa file");
      return;
    }

    runLinter(activeEditor.document);
  });
  const lintAllCommand = vscode.commands.registerCommand("metta-linter.lintAll", async () => {
        vscode.window.showInformationMessage("Linting all .metta files in workspace...");
        await lintAllMettaFiles();
        vscode.window.showInformationMessage("Finished linting all .metta files");
  });
  const openDisposable = vscode.workspace.onDidOpenTextDocument((doc) => {
    if (doc.languageId !== "metta" && !doc.fileName.endsWith(".metta")) {
      return;
    }

    console.log("MeTTa file opened, running linter!");
    runLinter(doc);
  });
  const closeDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
    diagnosticCollection.delete(doc.uri);
  });

  context.subscriptions.push(
    disposable,
    lintCommand,
    lintAllCommand,
    openDisposable,
    closeDisposable,
    diagnosticCollection,
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("MeTTa linter extension deactivated");
}
