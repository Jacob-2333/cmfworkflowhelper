import * as LBOS from 'cmf-lbos';
import { CmfToken } from './cmftoken';
import * as vscode from 'vscode';

export class LocalFramework {
    public LBOS = LBOS;
    public system = new System();

    // public funa() {
    //     // 正确的方式 (ES 模块动态导入)
    //     import('@criticalmanufacturing/connect-iot-controller-engine-custom-utilities-tasks/metadata')
    //         .then((module) => {
    //             // 在这里使用 tasks
    //             let a=module.Metadata.tasks?module.Metadata.tasks:[];
    //             console.log(JSON.stringify(a));
    //         })
    //         .catch((error) => {
    //             console.error('模块加载失败', error);
    //         });
    //     let a=utilities.Metadata.tasks;
    //     console.log(JSON.stringify(a));
    // }
}

export class System {
    public context: any;
    public cmf_access_token: any = {};
    private cmfToken = new CmfToken();
    // private access_token_obj: any = {};

    public async initialize(context: vscode.ExtensionContext) {
        this.context = context;
        // 读取数据
        this.cmf_access_token = context.globalState.get('cmf_access_token');
        const currentDate = new Date();
        const currTimestamp = Math.floor(currentDate.getTime() / 1000);

        // this.cmf_access_token=null;
        if (!this.cmf_access_token || !this.cmf_access_token.access_token ||
            !this.cmf_access_token.expires_in || !this.cmf_access_token.timestamp
            || currTimestamp - this.cmf_access_token.timestamp > this.cmf_access_token.expires_in) {

            // let token_endpoint = await this.cmfToken.getOpenidConfiguration();
            // console.log(token_endpoint);
            // this.cmf_access_token = await this.cmfToken.getAccessToken(token_endpoint, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRJZCI6Ik1FUyIsInRlbmFudE5hbWUiOiJCb3JnV2FybmVyU3V6aG91Iiwic3ViIjoiR0xPQkFMXFxCUkNBSSIsInNjb3BlIjpudWxsLCJleHRyYVZhbHVlcyI6bnVsbCwidHlwZSI6IlBBVCIsImlhdCI6MTcxMDMwNjI4MiwiZXhwIjoyMTQ1NTQyMzk5LCJhdWQiOiJBdXRoUG9ydGFsIiwiaXNzIjoiQXV0aFBvcnRhbCJ9.p6v5LWgoCMF5fpN6GG7rX4icsIxzQ8o4wHL3wxXq4bU");
            this.cmf_access_token = {
                host: "",//http://suzvsmesapp21.global.borgwarner.net//http://localhost:8083
                expires_in: 36000,
                access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJDTUZcXGNjYWkiLCJ0ZW5hbnROYW1lIjoiQm9yZ1dhcm5lclN1emhvdSIsIm5iZiI6MTcxMjE5NzA1OCwiZXhwIjoxNzEzNDA2NjU4LCJpc3MiOiJDTUZIb3N0IiwiYXVkIjoiTUVTIn0.A9COsruRtqJNuphmA5mavA1yeE3-9k5mfojYGyp8pGE",
                timestamp: currTimestamp
            };
            console.log(JSON.stringify(this.cmf_access_token));
            // 写入数据
            context.globalState.update('cmf_access_token', this.cmf_access_token);
        }

        // let messagebus_token=await this.cmfToken.getApplicationBootInformation(access_token);
        // console.log(messagebus_token);
    }

    public async refresh(){
        this.cmf_access_token = this.context.globalState.get('cmf_access_token');
    }

    public async call(input: any): Promise<any> {
        // console.log(JSON.stringify(input));
        try{
            let type = input["$type"];
            let tag1list = type.split('Management')[0].split('.');
            let tag1 = tag1list[tag1list.length - 1];
            let tag2list = type.split('InputObjects.');
            let tag2 = tag2list[tag2list.length - 1].split('Input,')[0];
    
            console.log("===============");
            let url = `${this.cmf_access_token.host}/api/${tag1}/${tag2}`;
            let output: any;
            let tag3list = type.split('.');
            if (tag3list[tag3list.length - 1].includes('Get')) {
                output = await this.cmfToken.systemCallGet(url, input, this.cmf_access_token.access_token);
            } else {
                output = await this.cmfToken.systemCallPost(url, input, this.cmf_access_token.access_token);
            }
            return output;
        }
        catch(ex){
            throw ex;
        }
    }
}