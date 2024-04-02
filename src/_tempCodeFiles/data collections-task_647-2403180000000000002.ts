import { Framework } from 'framework';

export default class {

    /** Allows accessing external functions */
    private framework: Framework;
    private passFlag = "PASS";
    private failFlag = "FAIL";

    constructor(framework: Framework) {
        this.framework = framework;
    }

    /*
     * Entry point of the class (IMPORTANT: don't change the signature of this method)
     * Should return an object containing the values for each output to emit
     * If necessary, use the parameter "outputs" to emit data while running the code.
     */
    public async main(inputs: any, outputs: any): Promise<any> {
        // Add code here
        let batchPassFail = inputs.batchPassFail;
        for (let materialName of batchPassFail.materialNames) {
            outputs.resource.emit({ Name: batchPassFail.resourceName });
            outputs.material.emit({ Name: materialName });
            // outputs.passFail.emit(batchPassFail.status);
            if (batchPassFail.status = this.passFlag) {
                outputs.passFail.emit("Pass");
            } else {
                outputs.passFail.emit("Fail");
            }
            await this.framework.utils.sleep(50);
        }
    }
}
