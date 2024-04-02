import * as LBOS from 'cmf-lbos';
import * as engine from '@criticalmanufacturing/connect-iot-controller-engine';
// import { sleep, ExecuteWithRetry, ExecuteWithSystemErrorRetry, convertValueToType } from '@criticalmanufacturing/connect-iot-controller-engine';
// import * as framework from '../src/types/system';
import { CmfToken } from './cmftoken';
import * as vscode from 'vscode';
import 'reflect-metadata';

export class Framework {
    public LBOS=LBOS;
    // public LBOS = engine.System.LBOS;
    // public dataStore = new engine.System.MemoryDataStore(); 
    // public logger = new engine.Dependencies.LoggerTask();
    // public utils = {
    //     sleep:engine.Utilities.sleep,
    //     ExecuteWithRetry:engine.Utilities.ExecuteWithRetry,
    //     ExecuteWithSystemErrorRetry:engine.Utilities.ExecuteWithSystemErrorRetry,
    //     convertValueToType:engine.Utilities.convertValueToType
    // };
    public system = new System();
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

        if (!this.cmf_access_token || !this.cmf_access_token.access_token ||
            !this.cmf_access_token.expires_in || !this.cmf_access_token.timestamp
            || currTimestamp - this.cmf_access_token.timestamp > this.cmf_access_token.expires_in) {

            let token_endpoint = await this.cmfToken.getOpenidConfiguration();
            console.log(token_endpoint);
            this.cmf_access_token = await this.cmfToken.getAccessToken(token_endpoint, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRJZCI6Ik1FUyIsInRlbmFudE5hbWUiOiJCb3JnV2FybmVyU3V6aG91Iiwic3ViIjoiR0xPQkFMXFxCUkNBSSIsInNjb3BlIjpudWxsLCJleHRyYVZhbHVlcyI6bnVsbCwidHlwZSI6IlBBVCIsImlhdCI6MTcxMDMwNjI4MiwiZXhwIjoyMTQ1NTQyMzk5LCJhdWQiOiJBdXRoUG9ydGFsIiwiaXNzIjoiQXV0aFBvcnRhbCJ9.p6v5LWgoCMF5fpN6GG7rX4icsIxzQ8o4wHL3wxXq4bU");

            this.cmf_access_token.timestamp = currTimestamp;
            console.log(JSON.stringify(this.cmf_access_token));
            // 写入数据
            context.globalState.update('cmf_access_token', this.cmf_access_token);
        }

        // let messagebus_token=await this.cmfToken.getApplicationBootInformation(access_token);
        // console.log(messagebus_token);
    }

    public async call(input: any): Promise<any> {
        // console.log(JSON.stringify(input));
        let type = input["$type"];
        let tag1list = type.split('Management')[0].split('.');
        let tag1 = tag1list[tag1list.length - 1];
        let tag2list = type.split('InputObjects.');
        let tag2 = tag2list[tag2list.length - 1].split('Input,')[0];

        console.log("===============");
        let url = `http://suzvsmesapp21.global.borgwarner.net/api/${tag1}/${tag2}`;
        let output: any;
        let tag3list = type.split('.');
        if (tag3list[tag3list.length - 1].includes('Get')) {
            output = await this.cmfToken.systemCallGet(url, input, this.cmf_access_token.access_token);
        } else {
            output = await this.cmfToken.systemCallPost(url, input, this.cmf_access_token.access_token);
        }
        return output;
    }
}