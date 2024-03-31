import axios, { AxiosResponse } from 'axios';

// // 定义请求接口的类型
// interface IApiResponse<T> {
//     status: number;
//     data: T;
// }

// // 定义请求数据类型示例
// interface IData {
//     id: number;
//     name: string;
// }

export class CmfToken {
    _requestDefaultHeaders: any = {
        Cmf_ReturnFaultExceptions: false,
        Cmf_CurrentCulture: "en-US",
        Cmf_RequestedTimeZone: "",
        Cmf_ClientTenantName: "BorgWarnerSuzhou",
        Cmf_HostName: "SUZVSMESAPP21.Global.borgwarner.net",
        Cmf_SessionId: Math.random() * (1000000000000 - 1) + 1,
        Cmf_SignatureToken: 555984152,
        Cmf_RequestedUserName: null,
        "Content-Type": "application/json; charset=UTF-8"
    };

    public openIdConfiguration = "http://suzvsmesapp21.global.borgwarner.net:9091/tenant/BorgWarnerSuzhou/.well-known/openid-configuration";

    public async getOpenidConfiguration() {
        const getDataResult = await this.sendGetRequest(this.openIdConfiguration);
        return getDataResult.token_endpoint;
    }

    public async getAccessToken(url: string, refresh_token: string): Promise<string> {
        const res = await this.sendPostRequest(url, {
            grant_type: "refresh_token",
            client_id: "MES",
            refresh_token: refresh_token
        });
        return res.access_token;
    }

    public async getApplicationBootInformation(access_token: string) {
        const res = await this.sendPostRequest("http://suzvsmesapp21.global.borgwarner.net/api/ApplicationSetting/GetApplicationBootInformation", {}, {
            Authorization: `Bearer ${access_token}`
        });
        return res.MessageBusToken;
    }

    // 发送GET请求
    public async sendGetRequest(url: string, headers?: any): Promise<any> {
        try {
            let _headers = this._requestDefaultHeaders;
            if (headers) {
                for (const key of Object.keys(headers)) {
                    _headers[key] = headers[key];
                }
            }
            // headers = headers ? headers : this._requestDefaultHeaders;
            const response: AxiosResponse<any> = await axios.get(url, {
                headers: _headers,
            });
            return response.data;
        } catch (error) {
            console.error('Error in GET request:', error);
            throw error;
        }
    }

    // 发送POST请求
    public async sendPostRequest(url: string, data: any, headers?: any): Promise<any> {
        try {
            let _headers = this._requestDefaultHeaders;
            if (headers) {
                for (const key of Object.keys(headers)) {
                    _headers[key] = headers[key];
                }
            }
            // headers = headers ? headers : this._requestDefaultHeaders;
            const response: AxiosResponse<any> = await axios.post(url, data, {
                headers: _headers,
            });
            return response.data;
        } catch (error) {
            console.error('Error in POST request:', error);
            throw error;
        }
    }

    // public async test() {
    //     const getDataResult = await this.sendGetRequest();
    //     console.log('GET Response:', getDataResult);

    //     const postData: IData = { id: 1, name: 'Example Data' };
    //     const postDataResult = await this.sendPostRequest(postData);
    //     console.log('POST Response:', postDataResult);
    // }


    // _requestDefaultHeaders = {
    //     Cmf_ReturnFaultExceptions: false,
    //     Cmf_CurrentCulture: "en-US",
    //     Cmf_RequestedTimeZone: "",
    //     Cmf_ClientTenantName: "BorgWarnerSuzhou",
    //     Cmf_HostName: "ConnectIoT",
    //     Cmf_SessionId: Math.random() * (1000000000000 - 1) + 1,
    //     Cmf_SignatureToken: 555984152,
    //     Cmf_RequestedUserName: null,
    //     "Content-Type": "application/json; charset=UTF-8"
    // };

    // authenticateBySecurityPortal(config:any) {
    //     // return 
    //         // this._logger.debug(`SecurityToken Authenticate: clientId='${config.clientId}', openIdConfiguration='${config.openIdConfiguration}'`);
    //         const tokenRequestData = {
    //             grant_type: "refresh_token",
    //             client_id: config.clientId,
    //             refresh_token: config.accessToken
    //         };
    //         return (this.authenticateBySecurityPortalShared(config.openIdConfiguration, tokenRequestData));
    // }

    // authenticateBySecurityPortalShared(openIdConfiguration:any, tokenRequestData:any) {
    //         try {
    //             // First, get the entire configuration addresses using OpenId
    //             let reply =  this.restClient("GET", openIdConfiguration)
    //                 .timeout(60000);
    //             let response = reply.body;
    //             if (!("token_endpoint" in response)) {
    //                 throw new Error("Invalid response: token_endpoint not present");
    //             }
    //             const token_endpoint = response.token_endpoint;
    //             // this._logger.debug(`SecurityToken Authenticate: token_endpoint='${token_endpoint}'`);
    //             reply = yield this.restClient("POST", token_endpoint)
    //                 .set(this._requestDefaultHeaders)
    //                 .timeout(60000)
    //                 .set("Content-Type", "application/x-www-form-urlencoded")
    //                 .send(this._serializer.toUrlEncoded(tokenRequestData));
    //             if (reply.statusCode !== 200) {
    //                 throw new Error(`Invalid response: error code '${reply.statusCode}' reply: '${JSON.stringify(reply)}'`);
    //             }
    //             response = reply.body;
    //             if (!("access_token" in response)) {
    //                 throw new Error("Invalid response: access_token not present");
    //             }
    //             if (!("token_type" in response && response.token_type.toString().toLocaleLowerCase() === "bearer" && "access_token" in response)) {
    //                 throw new Error("Invalid response: token_type / access_token not present");
    //             }
    //             const access_token = response.access_token;
    //             const expires_in = response.expires_in || "unknown";
    //             // this._logger.info(`Authentication in SecurityPortal successful and valid for '${expires_in}' ms`);
    //             // If ok, then lets store the information on the headers field
    //             Object.assign(this._requestDefaultHeaders, {
    //                 Authorization: `Bearer ${access_token}`,
    //             });
    //             // Get Message Bus transport configuration from Host
    //             const mbTransportConfig = yield this.call(new CommonLBOs.Cmf.Foundation.BusinessOrchestration.ApplicationSettingManagement.InputObjects.GetApplicationBootInformationInput(), false);
    //             // Store the message bus configuration for later use
    //             const mbToken = mbTransportConfig.MessageBusToken || access_token;
    //             this._messageBusConfig = Utils.toCamelCase(JSON.parse(mbTransportConfig.TransportConfig));
    //             this._messageBusConfig.tenantName = this._config.tenantName;
    //             this._messageBusConfig.securityToken = mbToken;
    //             this.emit("NewSecurityToken", mbToken);
    //             this._lastApiCallFailed = false;
    //             // this._logger.info(`Authentication successful!`);
    //         }
    //         catch (responseError) {
    //         }
    // }

    // restClient(method:any, url:any) {
    //     let request = (0, superagent_1.default)(method, url);
    //     // This is required in superagent >= 5.1.2
    //     if (process.env["NODE_TLS_REJECT_UNAUTHORIZED"] === "0" &&
    //         typeof request["disableTLSCerts"] === "function") {
    //         request.disableTLSCerts();
    //     }
    //     return (request);
    // }
}