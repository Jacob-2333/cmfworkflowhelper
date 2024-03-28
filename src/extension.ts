// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// vscode.window.createTreeView('nodeDependencies', {
	// 	treeDataProvider: new NodeDependenciesProvider("F:\\VS2024\\MyVscodeExtension\\cmfworkflowhelper")
	// });
	const nodeDependenciesProvider = new NodeDependenciesProvider("F:\\VS2024\\MyVscodeExtension\\cmfworkflowhelper");
	vscode.window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);
	vscode.commands.registerCommand('nodeDependencies.refreshEntry', () =>{
		nodeDependenciesProvider.refresh();
		console.log("my refresh")

	}
  );

	// my first webview
	// 创建一个webview面板
	const panel = vscode.window.createWebviewPanel(
		'myWebview',//试图类型，必须是唯一的
		'My Webview', //面板标题
		vscode.ViewColumn.One,//显示在哪一列
		{ enableScripts: true }//面板配置
	);

	// 定时更新页面数据
	// let iteration = 0;
	// const updateWebview = () => {
	// 	const cat = iteration++ % 2 ? "Compiling Cat" : "Coding Cat";
	// 	panel.title = cat;
	// 	panel.webview.html = getWebviewContent(cat);
	// };

	// updateWebview();

	// setInterval(updateWebview, 1000);

	// 设置面板消息监听
	panel.webview.onDidReceiveMessage(
		async message => {
			// 处理来自webview的消息
			switch (message.command) {
				case "showMessage":
					vscode.window.showInformationMessage(message.text);
					break;
				case "listEditors": {
					// let textdoc:vscode.TextDocument=new vscode.TextDocument();
					// 先尝试创建文件
					// let textEditor= await vscode.window.showTextDocument(vscode.Uri.file('F:\\VS2024\\MyVscodeExtension\\testfiles\\test2.json'));
					// let text = textEditor.document.getText();
					// // textEditor.document
					// console.log(`text: ${text}`);
					// let editors = vscode.window.visibleTextEditors;
					// console.log(editors)
					// editors.forEach(editor => {
					// 	console.log(editor.document);
					// });
					let filePath = vscode.Uri.joinPath(vscode.Uri.file('F:\\VS2024\\MyVscodeExtension\\testfiles\\test2.json'));
					// let filePath = vscode.Uri.joinPath(vscode.Uri.parse('F:\\VS2024\\MyVscodeExtension\\testfiles\\'), 'newFile.txt');
					try {
						await fs.promises.writeFile(filePath.fsPath, `{"test":"test1"}`);
						console.log(`create file successed`);
					} catch (error: any) {
						vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
						return;
					}
					let doc = vscode.workspace.openTextDocument(filePath);
					doc.then(document => {
						let aa = vscode.window.showTextDocument(document);
						aa.then(textEditor => {
							let text = textEditor.document.getText();
							// textEditor.document
							console.log(`text: ${text}`);
							let editors = vscode.window.visibleTextEditors;
							console.log(editors)
							editors.forEach(editor => {
								console.log(editor.document);
							});

						})
					});

					break;
				}
			}
			console.log(message);
			// vscode.window.showInformationMessage("message received from webview");
		}
	);

	//设置面板的内容
	panel.webview.html = getWebviewContent("none");

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "cmfworkflowhelper" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('cmfworkflowhelper.helloWorld!!!', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello VS Code from CMFWorkflowHelper!!!');
	});

	context.subscriptions.push(disposable);

}

function getWebviewContent(cat: string) {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
	    <meta charset="UTF-8">
	    <title>My Webview</title>
	</head>
	<body>
	    <h1>Hello, Webview! ${cat}</h1>
	    <button onclick="postMessageToExtension()">Send Message</button>
	    <button onclick="listEditors()">List Editors</button>
	    <script>
			const vscode=acquireVsCodeApi();
	        function postMessageToExtension() {
	            // 发送消息到扩展
	            // window.postMessage({ command: 'showMessage', text: 'Hello from Webview' });
				vscode.postMessage({
					command: "showMessage",
					text:"Hello from Webview! acquireVsCodeApi();"
				})
	        }
			function listEditors(){
				vscode.postMessage({
					command: "listEditors"
				})
			}
	    </script>
	</body>
	</html>
	`;
}

// This method is called when your extension is deactivated
export function deactivate() { }


export class NodeDependenciesProvider implements vscode.TreeDataProvider<Dependency> {
	constructor(private workspaceRoot: string) { }

	getTreeItem(element: Dependency): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Dependency): Thenable<Dependency[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}

		if (element) {
			return Promise.resolve(
				this.getDepsInPackageJson(
					path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')
				)
			);
		} else {
			const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
			if (this.pathExists(packageJsonPath)) {
				return Promise.resolve(this.getDepsInPackageJson(packageJsonPath));
			} else {
				vscode.window.showInformationMessage('Workspace has no package.json');
				return Promise.resolve([]);
			}
		}
	}

	/**
	 * Given the path to package.json, read all its dependencies and devDependencies.
	 */
	private getDepsInPackageJson(packageJsonPath: string): Dependency[] {
		if (this.pathExists(packageJsonPath)) {
			const toDep = (moduleName: string, version: string): Dependency => {
				if (this.pathExists(path.join(this.workspaceRoot, 'node_modules', moduleName))) {
					return new Dependency(
						moduleName,
						version,
						vscode.TreeItemCollapsibleState.Collapsed
					);
				} else {
					return new Dependency(moduleName, version, vscode.TreeItemCollapsibleState.None);
				}
			};

			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

			const deps = packageJson.dependencies
				? Object.keys(packageJson.dependencies).map(dep =>
					toDep(dep, packageJson.dependencies[dep])
				)
				: [];
			const devDeps = packageJson.devDependencies
				? Object.keys(packageJson.devDependencies).map(dep =>
					toDep(dep, packageJson.devDependencies[dep])
				)
				: [];
			return deps.concat(devDeps);
		} else {
			return [];
		}
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}
		return true;
	}

	private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | null | void> = new vscode.EventEmitter<Dependency | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | null | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

class Dependency extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		private version: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		this.tooltip = `${this.label}-${this.version}`;
		this.description = this.version;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};
}