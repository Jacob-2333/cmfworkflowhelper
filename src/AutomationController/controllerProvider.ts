
import * as vscode from 'vscode';
import * as path from 'path';
import { ControllerManager } from './controllerManager';

export class ControllerProvider implements vscode.TreeDataProvider<Controller> {
    constructor(private controllerManager: ControllerManager) { }

    getTreeItem(element: Controller): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Controller): Thenable<Controller[]> {
        if (!this.controllerManager) {
            vscode.window.showInformationMessage('No automation controller loaded or initialized!');
            return Promise.resolve([]);
        }

        if (element) {
            let iconPath = path.join(__filename, '..', '..', '../resources', 'workflow.svg');
            let a = new Controller("controller1", "1111", "", "a1", vscode.TreeItemCollapsibleState.None, iconPath);
            let b = new Controller("controller2", "1112", "", "b1", vscode.TreeItemCollapsibleState.None, iconPath);
            let c = new Controller("controller2", "1113", "", "c1", vscode.TreeItemCollapsibleState.None, iconPath);
            return Promise.resolve(
                [a, b, c]
            );
        } else {
            return this.controllerManager.queryControllerList("AOI").then((controllerList) => {
                console.log(JSON.stringify(controllerList));
                let list = [];
                for (let item of controllerList) {
                    list.push(new Controller(item['Name'], item['Id'], "", item['Revision'], vscode.TreeItemCollapsibleState.Collapsed));
                }
                // vscode.window.showInformationMessage('No automation controller loaded1');
                return list;
            });
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Controller | undefined | null | void> = new vscode.EventEmitter<Controller | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Controller | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

class Controller extends vscode.TreeItem {

    constructor(
        public readonly label: string,
        public id: string,
        public description: string,
        private version: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        _iconPath?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}-${this.version}`;
        this.id = id;
        this.description = `${this.version}-${this.description}`;
        this.iconPath = _iconPath ? _iconPath : path.join(__filename, '..', '..', '..', 'resources', 'controller.svg');
    }

    // iconPath = {
    //     light: path.join(__filename, '..', '..', '../resources', 'light', 'dependency.svg'),
    //     dark: path.join(__filename, '..', '..', '../resources', 'dark', 'dependency.svg')
    // };
}