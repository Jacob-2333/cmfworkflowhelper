// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { NodeDependenciesProvider } from './NodeDependenciesProvider';
import { CmfToken } from './cmftoken';
import { Framework } from './framework';
import { ControllerManager } from './AutomationController/controllerManager';
import { ControllerProvider } from './AutomationController/controllerProvider';

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

	context.subscriptions.push(disposable1);
	context.subscriptions.push(disposable2);
	context.subscriptions.push(disposable3);


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

}



// This method is called when your extension is deactivated
export function deactivate() { }
