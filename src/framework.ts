import * as LBOS from 'cmf-lbos';
import { CmfToken } from './cmftoken';

export class Framework{
    public LBOS=LBOS;

    public system=new System();
}

export class System{
	private cmfToken=new CmfToken();
    private access_token:string="";

    public async initialize(){
		let token_endpoint=await this.cmfToken.getOpenidConfiguration();
		console.log(token_endpoint);
		this.access_token=await this.cmfToken.getAccessToken(token_endpoint,"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRJZCI6Ik1FUyIsInRlbmFudE5hbWUiOiJCb3JnV2FybmVyU3V6aG91Iiwic3ViIjoiR0xPQkFMXFxCUkNBSSIsInNjb3BlIjpudWxsLCJleHRyYVZhbHVlcyI6bnVsbCwidHlwZSI6IlBBVCIsImlhdCI6MTcxMDMwNjI4MiwiZXhwIjoyMTQ1NTQyMzk5LCJhdWQiOiJBdXRoUG9ydGFsIiwiaXNzIjoiQXV0aFBvcnRhbCJ9.p6v5LWgoCMF5fpN6GG7rX4icsIxzQ8o4wHL3wxXq4bU");
		console.log(this.access_token);
		// let messagebus_token=await this.cmfToken.getApplicationBootInformation(access_token);
		// console.log(messagebus_token);
    }
    
    public async call(input:any):Promise<any>{
        // console.log(JSON.stringify(input));
        let type=input["$type"];
        let tag1list=type.split('Management')[0].split('.');
        let tag1=tag1list[tag1list.length-1];
        let tag2list=type.split('InputObjects.');
        let tag2=tag2list[tag2list.length-1].split('Input,')[0];

        console.log("===============");
        let url=`http://suzvsmesapp21.global.borgwarner.net/api/${tag1}/${tag2}`;
        let output=await this.cmfToken.systemCallGet(url,input,this.access_token);
        return output;
    }
}