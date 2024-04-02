// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { NodeDependenciesProvider } from './NodeDependenciesProvider';
import { CmfToken } from './cmftoken';
import { Framework } from './framework';
import { ControllerManager } from './AutomationController/controllerManager';
import { ControllerProvider } from './AutomationController/controllerProvider';
import * as ts from 'typescript';

const framework = new Framework();
let controllerManager: ControllerManager;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const nodeDependenciesProvider = new NodeDependenciesProvider("F:\\VS2024\\MyVscodeExtension\\cmfworkflowhelper");
	// const nodeDependenciesProvider = new NodeDependenciesProvider("E:\\VS2024\\Vscode\\cmfworkflowhelper");
	vscode.window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);
	let disposable1 = vscode.commands.registerCommand('nodeDependencies.refreshEntry', () => {
		nodeDependenciesProvider.refresh();
		console.log("my refresh");
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable2 = vscode.commands.registerCommand('automationcontrollerlist.loadControllerList', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('In this function, we will load controllers');

		const controllerManagerProvider = new ControllerProvider(controllerManager);
		vscode.window.registerTreeDataProvider('automationcontrollerlist', controllerManagerProvider);
	});

	let disposable3 = vscode.commands.registerCommand('automationcontrollerlist.configToken', () => {
		vscode.window.showInformationMessage('config your token!');
	});

	let disposable4 = vscode.commands.registerCommand('automationcontrollerlist.customOpenFile', async (body, filePath) => {
		let fileFullPath = path.join(__filename, '..', '..', 'src','_tempCodeFiles', filePath);
		console.log(fileFullPath);
		vscode.window.showInformationMessage(`${fileFullPath}`);
		// let filePath = vscode.Uri.joinPath(vscode.Uri.file('F:\\VS2024\\MyVscodeExtension\\cmfworkflowhelper\\resources\\test2.json'));
		try {
			let tsCode=fromMultilineArray(body);
			// const compiledJsCode = compileTsToJs(tsCode);
			// console.log('Compiled JavaScript:', compiledJsCode);
			await fs.promises.writeFile(fileFullPath, tsCode);

			console.log(`create file successed`);
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
			return;
		}
		let doc = await vscode.workspace.openTextDocument(fileFullPath);
		let textEditor = await vscode.window.showTextDocument(doc);


		// let text = textEditor.document.getText();
		// let editors = vscode.window.visibleTextEditors;
		// console.log(editors)
		// editors.forEach(editor => {
		// 	console.log(editor.document);
		// });
	});

	context.subscriptions.push(disposable1);
	context.subscriptions.push(disposable2);
	context.subscriptions.push(disposable3);
	context.subscriptions.push(disposable4);


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "cmfworkflowhelper" is now active!');



	framework.system.initialize().then(() => {
		controllerManager = new ControllerManager(framework);
		// const input = new framework.LBOS.Cmf.Foundation.BusinessOrchestration.GenericServiceManagement.InputObjects.GetObjectByNameInput();
		// input.Name = "_ARRAY1702993198_30184";
		// input.LevelsToLoad = 0;
		// input.Type = "Material";

		// const res = framework.system.call(input);
		// res.then((result)=>{
		// 	result.Instance.Name;
		// 	console.log(JSON.stringify(result));
		// });
	});
	// 编译函数
	function compileTsToJs(tsCode: string): string {
		// 设置编译选项
		const compilerOptions: ts.CompilerOptions = {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.CommonJS,
			// 添加更多选项，例如lib、strict等
		};

		// 使用TypeScript编译器API实时编译
		const output = ts.transpileModule(tsCode, { compilerOptions });

		// 返回编译后的JavaScript代码
		return output.outputText;
	}
	
    /**
     * Converts a string with multiple lines to an array of strings where each entry represents a line.
     * Also replaces tabs with spaces.
     * Useful for readability when saving to json.
     */
    function toMultilineArray(value: any) {
        return value?.replace(/\t/g, '    ').split('\n') || [];
    }
    /** Converts an array of strings to a single string with line breaks */
    function fromMultilineArray(value: any) {
        return value?.join('\n') || '';
    }
}



// This method is called when your extension is deactivated
export function deactivate() { }
