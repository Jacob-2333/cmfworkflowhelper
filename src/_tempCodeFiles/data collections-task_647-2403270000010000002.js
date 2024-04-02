"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class default_1 {
    /** Allows accessing external functions */
    framework;
    passFlag = "PASS";
    failFlag = "FAIL";
    constructor(framework) {
        this.framework = framework;
    }
    /*
     * Entry point of the class (IMPORTANT: don't change the signature of this method)
     * Should return an object containing the values for each output to emit
     * If necessary, use the parameter "outputs" to emit data while running the code.
     */
    async main(inputs, outputs) {
        // Add code here
        let batchPassFail = inputs.batchPassFail;
        for (let materialName of batchPassFail.materialNames) {
            outputs.resource.emit({ Name: batchPassFail.resourceName });
            outputs.material.emit({ Name: materialName });
            // outputs.passFail.emit(batchPassFail.status);
            if (batchPassFail.status = this.passFlag) {
                outputs.passFail.emit("Pass");
            }
            else {
                outputs.passFail.emit("Fail");
            }
            await this.framework.utils.sleep(50);
        }
    }
}
exports.default = default_1;
//# sourceMappingURL=data%20collections-task_647-2403270000010000002.js.map