// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// my first webview
	// 创建一个webview面板
	const panel = vscode.window.createWebviewPanel(
		'myWebview',//试图类型，必须是唯一的
		'My Webview', //面板标题
		vscode.ViewColumn.One,//显示在哪一列
		{enableScripts: true}//面板配置
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
		message => {
			// 处理来自webview的消息
			switch (message.command) {
				case "showMessage":
					vscode.window.showInformationMessage(message.text);
					break;
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
	    </script>
	</body>
	</html>
	`;
}

// This method is called when your extension is deactivated
export function deactivate() { }
