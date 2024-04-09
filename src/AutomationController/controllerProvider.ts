
import * as vscode from 'vscode';
// import * as fs from 'fs';
import * as path from 'path';
import { ControllerManager } from './controllerManager';

export class ControllerProvider implements vscode.TreeDataProvider<Controller> {
    constructor(private controllerManager: ControllerManager, private inputContext: string) { }

    getTreeItem(element: Controller): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Controller): Thenable<Controller[]> {
        if (!this.controllerManager) {
            vscode.window.showInformationMessage('No automation controller loaded or initialized!');
            return Promise.resolve([]);
        }

        if (element) {
            // console.log(JSON.stringify(element));
            switch (element.contextValue) {
                case "controller": {
                    // load controller versions
                    return this.controllerManager.queryControllerVersionList(element.label).then((versionList) => {
                        // console.log(JSON.stringify(versionList));
                        let iconPath = path.join(__filename, '..', '..', '../resources', 'version.svg');
                        let iconPath_Effectived = path.join(__filename, '..', '..', '../resources', 'version-effectived.svg');
                        let list = [];
                        for (let item of versionList) {
                            let universalState = this.controllerManager.universalStateMap[item['UniversalState']];
                            let label = `${item['Revision']}-${item['Version']} (${universalState})`;
                            if (item['Id'] !== element.id) {
                                let trueIconPath = universalState === "Effective" ? iconPath_Effectived : iconPath;
                                list.push(new Controller(label, item['Id'], item['Description'], "", vscode.TreeItemCollapsibleState.Collapsed, "controllerversion", trueIconPath));
                            }
                        }
                        vscode.window.showInformationMessage('Controller versions loaded!');
                        return list;
                    });
                }
                case "controllerversion": {
                    // load workflows
                    return this.controllerManager.loadAutomationControllerItems(element.id).then((controller) => {
                        let iconPath = path.join(__filename, '..', '..', '../resources', 'workflow.svg');
                        let workflows = controller.AutomationController.Workflows;

                        // //----------------------test

                        // let fileFullPath = path.join(__filename, '..', '..', '..', '_others', "test6.json");
                        // fs.promises.writeFile(fileFullPath, JSON.stringify(controller.AutomationController));
                        // //----------------------test

                        let list = [];
                        workflows.sort((a: any, b: any) => a.Order - b.Order);
                        for (let item of workflows) {
                            let universalState = this.controllerManager.universalStateMap[item['UniversalState']];
                            let label = item['DisplayName'];
                            // let trueIconPath=universalState === "Effective" ? iconPath_Effectived : iconPath;
                            list.push(new Controller(label, `${item['Id']}-${element.id}`, universalState, "", vscode.TreeItemCollapsibleState.Collapsed, "workflow", iconPath, controller.AutomationController));
                        }
                        // vscode.window.showInformationMessage('Workflows loaded!');
                        return list;
                    });
                }
                case "workflow": {
                    // load code tasks
                    for (let workflowItem of element.body.Workflows) {
                        if (workflowItem.Id === element.id.split('-')[0]) {
                            let tasks = JSON.parse(workflowItem.Workflow).tasks;

                            let iconPath = path.join(__filename, '..', '..', '../resources', 'code.svg');
                            let list = [];
                            // tasks.sort((a: any, b: any) => a.Order - b.Order);
                            for (let item of tasks) {
                                if (item["reference"]["name"] === "codeExecution") {
                                    let label = `${item["settings"]["___cmf___name"]}`;
                                    // let id = `${item['id']}-${element.body['Id']}`;
                                    let id = `${item['id']}-${element.id}`;
                                    // let tsCode = Buffer.from(item["settings"]["jsCodeBase64"], 'base64').toString('utf8');
                                    // let tsCode=item["settings"]["tsCode"];
                                    // let universalState = this.controllerManager.universalStateMap[item['UniversalState']];
                                    // let label = item['DisplayName'];
                                    // let trueIconPath=universalState === "Effective" ? iconPath_Effectived : iconPath;
                                    let tsFilePath=`${label}-${item['id']}-${workflowItem.Id}.ts`;
                                    // let tsFilePath=`${label}-${id}.ts`;
                                    list.push(new Controller(label, id, item['driver'], item["settings"]["___cmf___description"], vscode.TreeItemCollapsibleState.None, "codetask", iconPath, element.body, tsFilePath));
                                }
                            }
                            // vscode.window.showInformationMessage('Code tasks loaded!');
                            return Promise.resolve(list);
                        }
                    }

                }
                // case "codetask": {
                //     // load taskcode content to a new text editor
                //     break;
                // }
            }
            return Promise.resolve([]);
        } else {
            // load controllers
            return this.controllerManager.queryControllerList(this.inputContext).then((controllerList) => {
                // console.log(JSON.stringify(controllerList));
                let list = [];
                for (let item of controllerList) {
                    list.push(new Controller(item['Name'], item['Id'], item['Description'], item['Revision'], vscode.TreeItemCollapsibleState.Collapsed, "controller"));
                }
                vscode.window.showInformationMessage('Controller list loaded!');
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
        public contextValue: string,
        _iconPath?: string,
        public body?: any,
        public readonly filePath?: string,
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} ${this.version}`;
        this.id = id;
        this.description = this.description ? `${this.version?this.version+' - ':''}${this.description}` : this.version?this.version:'';
        this.iconPath = _iconPath ? _iconPath : path.join(__filename, '..', '..', '..', 'resources', 'controller.svg');
        if (filePath) {
            this.command = {
                command: 'automationcontrollerlist.customOpenFile',
                title: 'Open File',
                arguments: [body, id, filePath, this],
            };
        }
        // if(contextValue==="controllerversion"){
        //     this.command = {
        //         command: 'automationcontrollerlist.downloadEntry',
        //         title: 'Download Workflows',
        //         arguments: [id],
        //     };
        // }
        // this.contextValue=contextValue;
        // this.type=type;
    }

    // iconPath = {
    //     light: path.join(__filename, '..', '..', '../resources', 'light', 'dependency.svg'),
    //     dark: path.join(__filename, '..', '..', '../resources', 'dark', 'dependency.svg')
    // };
}