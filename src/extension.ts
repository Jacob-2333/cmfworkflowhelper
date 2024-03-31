// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { NodeDependenciesProvider } from './NodeDependenciesProvider';
import { CmfToken } from './cmftoken';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const cmfToken=new CmfToken();

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
		let token_endpoint=await cmfToken.getOpenidConfiguration();
		console.log(token_endpoint);
		let access_token=await cmfToken.getAccessToken(token_endpoint,"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRJZCI6Ik1FUyIsInRlbmFudE5hbWUiOiJCb3JnV2FybmVyU3V6aG91Iiwic3ViIjoiR0xPQkFMXFxCUkNBSSIsInNjb3BlIjpudWxsLCJleHRyYVZhbHVlcyI6bnVsbCwidHlwZSI6IlBBVCIsImlhdCI6MTcxMDMwNjI4MiwiZXhwIjoyMTQ1NTQyMzk5LCJhdWQiOiJBdXRoUG9ydGFsIiwiaXNzIjoiQXV0aFBvcnRhbCJ9.p6v5LWgoCMF5fpN6GG7rX4icsIxzQ8o4wHL3wxXq4bU");
		console.log(access_token);
		let messagebus_token=await cmfToken.getApplicationBootInformation(access_token);
		console.log(messagebus_token);
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
}

// This method is called when your extension is deactivated
export function deactivate() { }
