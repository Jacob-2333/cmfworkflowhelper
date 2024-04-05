import * as vscode from 'vscode';
  export function activate(context: vscode.ExtensionContext) {
    // 创建 Webview 面板
    const panel = vscode.window.createWebviewPanel(
      'myWebview', // 面板 ID
      'My Webview', // 面板标题
      vscode.ViewColumn.One, // 显示位置
      { enableScripts: true } // 启用 JavaScript
    );
    // 在 Webview 中加载 HTML 页面
    panel.webview.html = getWebviewContent();;
    // 监听 Webview 发送的消息
    panel.webview.onDidReceiveMessage(message => {
      if (message.type === 'buttonClick') {
        // 在 VS Code 中显示提示框
        vscode.window.showInformationMessage('Button clicked in Webview!');
      }
    });
    // 在 VS Code 中注册命令
    let disposable = vscode.commands.registerCommand('Hello-World.helloWorld', () => {
      // 向 Webview 发送消息
      panel.webview.postMessage({ type: 'showButton' });
    });
    context.subscriptions.push(disposable);
  }
  function getWebviewContent() {
    return `
      <html>
        <body>
          <button id="myButton">Click me</button>
          <script>
            const vscode = acquireVsCodeApi();
            const myButton = document.getElementById('myButton');
            myButton.addEventListener('click', () => {
              vscode.postMessage({ type: 'buttonClick' });
            });
          </script>
        </body>
      </html>
    `;
  }