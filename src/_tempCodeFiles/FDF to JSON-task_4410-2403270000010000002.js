"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Object.defineProperty(exports, "__esModule", { value: true });
class default_1 {
    constructor(framework) {
        this.framework = framework;
    }
    /*
     * Entry point of the class (IMPORTANT: don't change the signature of this method)
     * Should return an object containing the values for each output to emit
     * If necessary, use the parameter "outputs" to emit data while running the code.
     */
    async main(inputs, outputs) {
        let mInput = inputs.mInput; //RawDataEvent.values[0].value;
        let outObj;
        try {
            // parse message to JSON     
            // 1. Remove '\r\n'       
            mInput = mInput.replace(/\n/gm, "");
            mInput = mInput.replace(/\r/gm, "");
            this.framework.logger.warning("DataReceived:=" + mInput);
            const pairs = mInput.split('|');
            const varList = [];
            outObj = { uid: Date.now(), entity: "", name: pairs[0].toUpperCase().trim(), variables: varList };
            for (let i = 1; i < pairs.length; i++) {
                const varkey = pairs[i].split('='); //BCMP|name1=value1|name2=value2|name3=value3|name4=value4
                const newvar = { name: varkey[0], value: varkey[1] };
                varList.push(newvar);
            }
            // check validity of message
            switch (outObj.name) {
                case "BREQ":
                    break;
                case "BCMP":
                    break;
                // case "QUIT":
                //     this.framework.logger.info("QUIT Command received. Disconnecting");
                //     await this.framework.dataStore.store("quitOrder", Date.now(), "Temporary");
                //     return {};
                default:
                    await this.framework.dataStore.store("messageToSend", { name: "Unknown Message" }, "Temporary");
                    return {};
            }
            outObj.entity = await this.framework.dataStore.retrieve('LinkedEntityName', 'Unknown');
        }
        catch (error) {
            this.framework.logger.error("Invalid format message Received: " + mInput.toString());
            await this.framework.dataStore.store("messageToSend", { name: "Invalid format message" }, "Temporary");
            return {};
        }
        return { JSONToSend: JSON.stringify(outObj) };
    }
}
exports.default = default_1;
//# sourceMappingURL=FDF%20to%20JSON-task_4410-2403270000010000002.js.map