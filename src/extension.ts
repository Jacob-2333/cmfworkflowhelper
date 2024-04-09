// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LocalFramework } from './localFramework';
import { ControllerManager } from './AutomationController/controllerManager';
import { ControllerProvider } from './AutomationController/controllerProvider';
import * as ts from 'typescript';
// import 'reflect-metadata';

const localFramework = new LocalFramework();
let controllerManager: ControllerManager;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let searchInputContext: any = "";
	let controllerManagerProvider: ControllerProvider;
	async function refreshControllerList(search: boolean) {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		if (search) {
			searchInputContext = await vscode.window.showInputBox({
				placeHolder: 'Leave it empty if you want to load all...',
				prompt: `Key words for searching 'AutomationController'`,
			});
			if (searchInputContext !== undefined) {
				console.log(`Key words for searching 'AutomationController': ${searchInputContext}`);
			} else {
				searchInputContext = "";
			}
		}
		controllerManagerProvider = new ControllerProvider(controllerManager, searchInputContext);
		vscode.window.registerTreeDataProvider('automationcontrollerlist', controllerManagerProvider);
		// vscode.window.showInformationMessage('In this function, we will load controllers');

		// 获取所有已打开的编辑器
		let editorsCount = vscode.window.visibleTextEditors.length;
		while (editorsCount > 0) {
			// 关闭编辑器对应的文档，这会关闭所有打开此文档的编辑器窗口
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			// 可选：等待一段时间以确保编辑器关闭后再关闭下一个
			await new Promise(resolve => setTimeout(resolve, 20)); // 延迟100毫秒
			editorsCount = vscode.window.visibleTextEditors.length;
			if (editorsCount > 0) {
				// 切换到上一个编辑器
				await vscode.commands.executeCommand('workbench.action.previousEditor');
				await new Promise(resolve => setTimeout(resolve, 20)); // 延迟100毫秒
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
				await new Promise(resolve => setTimeout(resolve, 20)); // 延迟100毫秒
				let newEditorsCount = vscode.window.visibleTextEditors.length;
				if (editorsCount === newEditorsCount) {
					// 切换到下一个编辑器
					await vscode.commands.executeCommand('workbench.action.nextEditor');
					await new Promise(resolve => setTimeout(resolve, 20)); // 延迟100毫秒
					await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
					await new Promise(resolve => setTimeout(resolve, 20)); // 延迟100毫秒
				}
				editorsCount = vscode.window.visibleTextEditors.length;
			}
		}

		// 删除_tempCodeFiles文件夹下所有缓存的文件
		// 防止误删上级目录
		let dirPath = path.join(__filename, '..', '..', '_tempCodeFiles');
		// if (!dirPath.startsWith(process.cwd())) {
		vscode.window.showInformationMessage(`Clear directory path: ${dirPath}`);
		// throw new Error("Invalid directory path");
		// }

		try {
			const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);

				if (!entry.isDirectory()) {
					// 删除文件
					await fs.promises.unlink(fullPath);
				}
			}
		} catch (err) {
			// 处理错误，例如权限不足或其他异常情况
			vscode.window.showErrorMessage(`Failed to delete files in "${dirPath}"`);
			vscode.window.showErrorMessage(`${err}`);
		}

		// // 遍历并依次关闭每个编辑器
		// for (const editor of editors) {
		// 	// 关闭编辑器对应的文档，这会关闭所有打开此文档的编辑器窗口
		// 	await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		// 	// 切换到下一个编辑器
		// 	await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

		// }

		// 可选：打开一个新的空文档以确保至少有一个活动编辑器
		// await vscode.commands.executeCommand('workbench.action.newUntitledFile');
	}

	let disposable1 = vscode.commands.registerCommand('automationcontrollerlist.tokenEntry', async () => {
		let cmf_access_token: any = context.globalState.get('cmf_access_token');

		let tokenInput = await vscode.window.showInputBox({
			placeHolder: cmf_access_token && cmf_access_token.access_token ? cmf_access_token.access_token : 'Your access token...',
			prompt: `Input your Access Token`,
		});
		if (tokenInput !== undefined) {
			if (tokenInput.length > 0) {
				cmf_access_token.access_token = tokenInput;
				console.log(JSON.stringify(cmf_access_token));
				// 写入数据
				context.globalState.update('cmf_access_token', cmf_access_token);
				await localFramework.system.refresh();
				// console.log(`Key words for searching 'AutomationController': ${searchInputContext}`);
			}
		} else {
			vscode.window.showErrorMessage("Access Token is empty!");
			return;
		}
	});

	let disposable2 = vscode.commands.registerCommand('automationcontrollerlist.hostEntry', async () => {
		let cmf_access_token: any = context.globalState.get('cmf_access_token');

		let hostInput = await vscode.window.showInputBox({
			placeHolder: cmf_access_token && cmf_access_token.host ? cmf_access_token.host : 'Host of MES...',
			prompt: `Input the host of MES`,
		});
		if (hostInput !== undefined) {
			if (hostInput.length > 0) {
				cmf_access_token.host = hostInput;
				console.log(JSON.stringify(cmf_access_token));
				// 写入数据
				context.globalState.update('cmf_access_token', cmf_access_token);
				await localFramework.system.refresh();
				// console.log(`Key words for searching 'AutomationController': ${searchInputContext}`);
			}
		} else {
			vscode.window.showErrorMessage("Host is empty!");
			return;
		}
	});

	let disposable3 = vscode.commands.registerCommand('automationcontrollerlist.loadControllerList', () => { refreshControllerList(true); });

	let disposable4 = vscode.commands.registerCommand('automationcontrollerlist.customOpenFile', async (body, id, filePath, _self) => {
		let fileFullPath = path.join(__filename, '..', '..', '_tempCodeFiles', filePath);
		// _self.contextValue="codetask_selected";
		console.log(fileFullPath);
		// vscode.window.showInformationMessage(`${fileFullPath}`);
		// let filePath = vscode.Uri.joinPath(vscode.Uri.file('F:\\VS2024\\MyVscodeExtension\\cmfworkflowhelper\\resources\\test2.json'));
		try {
			let ids = id.split('-');
			let taskId = ids[0];
			let workflowId = ids[1];
			let controllerId = ids[2];
			// load code tasks
			for (let workflowItem of body.Workflows) {
				if (workflowItem.Id === workflowId) {
					let tasks = JSON.parse(workflowItem.Workflow).tasks;
					for (let taskItem of tasks) {
						if (taskItem['id'] === taskId) {
							let tsCode = fromMultilineArray(taskItem["settings"]["tsCode"]);
							// const compiledJsCode = compileTsToJs(tsCode);
							// console.log('Compiled JavaScript:', compiledJsCode);
							await fs.promises.writeFile(fileFullPath, tsCode);

							console.log(`create file successed`);
						}
					}
				}
			}
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

	let disposable5 = vscode.commands.registerCommand('automationcontrollerlist.saveEntry', async (treeView) => {
		// vscode.window.showInformationMessage('automationcontrollerlist.saveEntry');
		let fileFullPath = path.join(__filename, '..', '..', '_tempCodeFiles', treeView.filePath);

		let activeTextEditor = vscode.window.activeTextEditor;
		if (activeTextEditor) {
			console.log(activeTextEditor.document.fileName);
			if (fileFullPath === activeTextEditor.document.fileName) {

				// 检查代码是否存在错误
				const diagnostics = vscode.languages.getDiagnostics(activeTextEditor.document.uri);
				let hasErrors = false;
				diagnostics.forEach(diagnostic => {
					if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
						hasErrors = true;
						// 可以进一步处理错误信息，例如：打印错误位置和消息
						console.error(`Error at line ${diagnostic.range.start.line + 1}, column ${diagnostic.range.start.character}: ${diagnostic.message}`);
					}
				});

				if (hasErrors) {
					vscode.window.showErrorMessage('The current document contains errors.');
				} else {
					// vscode.window.showInformationMessage('The current document does not contain any error.');
					// 保存
					activeTextEditor.document.save();
					console.info(treeView.filePath);
					// 编译编辑器中的ts代码至js，并将workflow中code task的内容替换为编译后的js代码
					let tsCode = activeTextEditor.document.getText();
					let ids = treeView.id.split('-');
					let taskId = ids[0];
					let workflowId = ids[1];
					let controllerId = ids[2];
					let automationController = treeView.body;

					// load code tasks
					let changed = false;
					for (let workflowItem of treeView.body.Workflows) {
						if (workflowItem.Id === workflowId) {
							let workflow = JSON.parse(workflowItem.Workflow);
							for (let taskItem of workflow.tasks) {
								if (taskItem['id'] === taskId) {
									taskItem["settings"]["tsCode"] = toMultilineArray(tsCode);
									const compiledJsCode = compileTsToJs(tsCode);
									console.info(compiledJsCode);
									let _jsCodeBase64 = Buffer.from(compiledJsCode, 'utf8').toString('base64');
									if (taskItem["settings"]["jsCodeBase64"] !== _jsCodeBase64) {
										taskItem["settings"]["jsCodeBase64"] = _jsCodeBase64;
										workflowItem.Workflow = JSON.stringify(workflow);
										changed = true;
										break;
									}
								}
							}
							if (changed) {
								break;
							}
						}
					}

					//上传到MES
					try {
						let output = await controllerManager.fullUpdateAutomationController(treeView.body);
						treeView.body = output.AutomationController;
						vscode.window.showInformationMessage("All workflows are updated!");
					}
					catch (ex: any) {
						vscode.window.showErrorMessage(ex.response.data.Message);
					}
				}
			}
			else {
				vscode.window.showErrorMessage('Current actived file is not match the code you will save!');
			}
		}
		else {
			vscode.window.showErrorMessage('Please open a new tsCode first!');
		}
	});

	let disposable6 = vscode.commands.registerCommand('automationcontrollerlist.refreshEntry', () => { refreshControllerList(false); });
	let disposable7 = vscode.commands.registerCommand('automationcontrollerlist.searchEntry', () => { refreshControllerList(true); });

	let disposable8 = vscode.commands.registerCommand('automationcontrollerlist.downloadEntry', async (treeView) => {
		const options: vscode.OpenDialogOptions = {
			canSelectFiles: false, // 是否可以选择文件，默认为false
			canSelectFolders: true, // 是否可以选择文件夹，默认为false
			canSelectMany: false, // 是否可以选择多个项目，默认为false
			// defaultUri: vscode.Uri.file('/default/path'), // 可选，默认打开的路径
			openLabel: 'Select', // 可选，自定义确认按钮文本
			// filters: { // 可选，指定文件过滤器
			//   'Text Files': ['txt', 'md'],
			//   'Image Files': ['jpg', 'png', 'gif']
			// },
		};
		let filePathUrls: any = await vscode.window.showOpenDialog(options);
		console.log(filePathUrls);
		if (filePathUrls && filePathUrls.length > 0) {
			// 用户选择了至少一个文件或文件夹
			// for (const uri of filePathUrls) {
			//   console.log(uri.fsPath); // 打印出所选文件或文件夹的本地文件系统路径
			//   // 在这里处理用户选择的资源
			// }
			let controller = await controllerManager.loadAutomationControllerItems(treeView.id);
			let workflows = controller.AutomationController.Workflows;

			for (let item of workflows) {
				let label = item['DisplayName'];
				let fileFullPath = path.join(filePathUrls[0].fsPath, `${label}.json`);
				await fs.promises.writeFile(fileFullPath, item.Workflow);
			}
			vscode.window.showInformationMessage("All workflows download successfully!");
		} else {
			// 用户取消了对话框，没有选择任何资源
			console.log('User cancelled the dialog');
		}
	});


	context.subscriptions.push(disposable1);
	context.subscriptions.push(disposable2);
	context.subscriptions.push(disposable3);
	context.subscriptions.push(disposable4);
	context.subscriptions.push(disposable5);
	context.subscriptions.push(disposable6);
	context.subscriptions.push(disposable7);
	context.subscriptions.push(disposable8);


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "cmfworkflowhelper" is now active!');



	localFramework.system.initialize(context).then(() => {
		controllerManager = new ControllerManager(localFramework);
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
