import { Framework } from './framework';

export default class {

    /** Allows accessing external functions */
    private framework: Framework;
    private outputs: any;
    private passFlag = "PASS";
    private failFlag = "FAIL";
    private reworkFlag = "REWORK";
    private maxRetries = 3;
    private sleepBetweenRetries = 500;

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
        try {
            let msg = JSON.parse(inputs.JSONToSend);
            this.outputs = outputs;

            if (msg.name == "BCMP") {
                this.HandleBCMP(msg);
            }
        }
        catch (e) {
            await this.reply("", false, e.message);
        }
    }

    /**
     * BCMP message process
     * @param msg an object contains parsed parameters from BCMP message
     */
    public async HandleBCMP(msg: any) {
        let id = "";
        let process = "";
        let map = "";
        let defects = [];
        // let actions = [];
        let station = "";
        let status = "";
        let side = "";
        let isPositiveSequence = true;
        let recordData = [];

        let resourceName = await this.framework.dataStore.retrieve('entityResourceName', 'N/A');
        let resource = await this.getObjectByName(resourceName, "Resource");
        let defectRecordCountLimit = Number(await this.loadObjectAttribute(resource, "CustomDefectRecordCountLimit"));
        let unitMaterial = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.Material();
        let arrayName = "";

        for (let item of msg.variables) {
            if (item.name == "id") {
                id = item.value;
                unitMaterial = await this.getUnitMaterial(id);
                arrayName = unitMaterial.ParentMaterial.Name;
                if (!unitMaterial) {
                    await this.reply(id, false, `Unit: ${id} does not exist in MES!`);
                    return;
                }
                if (unitMaterial.Step.Name.includes("AOI_REVIEW") && unitMaterial.ParentMaterial.SystemState == 2) {
                    await this.trackOut(arrayName);
                    unitMaterial = await this.getUnitMaterial(id);
                }
            }
            if (item.name == "process") {
                process = item.value;
            }
            else if (item.name == "station") {
                station = item.value;
                if (station != msg.entity) {
                    await this.reply(id, false, `====== Incorrect Station! MES resource instance name: ${msg.entity}, FDF station: ${station}`);
                    return;
                }
            }
            else if (item.name == "software") {
                recordData.push(["software", item.value]);
                let software: string = item.value.toLowerCase();
                if (/[\-_](top)$/.exec(software)) side = "top";
                else if (/[\-_](bot)$/.exec(software)) side = "bot";
                else if (/[\-_](s1)$/.exec(software)) side = "top";
                else if (/[\-_](s2)$/.exec(software)) side = "bot";
                else if (/[\-_](rss1)$/.exec(software)) side = "top";
                else if (/[\-_](rss2)$/.exec(software)) side = "bot";

                else if (/[\-_](top)[\-_]/.exec(software)) side = "top";
                else if (/[\-_](bot)[\-_]/.exec(software)) side = "bot";
                else if (/[\-_](s1)[\-_]/.exec(software)) side = "top";
                else if (/[\-_](s2)[\-_]/.exec(software)) side = "bot";
                else if (/[\-_](rss1)[\-_]/.exec(software)) side = "top";
                else if (/[\-_](rss2)[\-_]/.exec(software)) side = "bot";

                this.framework.logger.warning(`====== side: ${side}`);
                const lineName = unitMaterial.ParentMaterial.ParentMaterial.Step.Name.toLowerCase();
                if (!lineName.includes(side)) {
                    await this.reply(id, false, `Unit: ${id} is in Line ${lineName}, but FDF software is ${software}`);
                    return;
                }
            }
            else if (item.name == "status") {
                status = item.value.toUpperCase();
                // recordData.push(["status", item.value]);
            }
            else if (item.name == "map") {
                recordData.push(["map", item.value]);
                map = item.value;
                // this.outputs.arrayMaterial.emit(unitMaterial.ParentMaterial);
                if (map.includes("0")) {
                    status = this.failFlag;
                    // this.outputs.passFail.emit("Fail");
                } else {
                    status = this.passFlag;
                    // this.outputs.passFail.emit("Pass");
                }
            }
            else if (item.name == "defect") {
                if (!defectRecordCountLimit || defects.length < defectRecordCountLimit) {
                    recordData.push(["defect", item.value]);
                    defects.push(item.value);
                }
            }
            // else if (item.name == "action") {
            //     recordData.push(["action", item.value]);
            //     actions.push(item.value);
            // }
        }

        try {
            if (side == "") side = "TOP";
            side = side.toUpperCase();
            let desStepName = `REFLOW_AOI_${side}`;
            if (unitMaterial.Step.Name != desStepName) {
                // Trackin & out from oven
                if (unitMaterial.Step.Name.includes("REFLOW_OVEN_")) {
                    if (unitMaterial.SystemState == 0) {
                        await this.trackInWithoutResourceInfo(arrayName);
                    }
                    await this.trackOut(arrayName);
                }

                // Change flow & step to destination step (process in FDF)
                unitMaterial = await this.getObjectByName(id, "Material", 3);
                if (unitMaterial.Step.Name != desStepName) {
                    if (unitMaterial.SystemState == 2) {
                        await this.trackOut(arrayName);
                        unitMaterial = await this.getObjectByName(id, "Material", 3);
                    }
                    await this.changeNearbyStep(unitMaterial.ParentMaterial, desStepName);
                    unitMaterial = await this.getObjectByName(id, "Material", 3);
                }
            }

            if (!unitMaterial.ParentMaterial.Step.Name.includes(process)) {
                await this.reply(id, false, `Unit: ${id} are not in correct step!`);
                return;
            }

            let unitIndex = Number(await this.loadObjectAttribute(unitMaterial, "CustomMapIndex"));
            let unitMaterails = await this.getChildMaterials(unitMaterial.ParentMaterial);
            if (unitIndex == 1) {
                isPositiveSequence = true;
            }
            else if (unitIndex == unitMaterails.length) {
                isPositiveSequence = false;
            }
            else {
                await this.reply(id, false, `Unit: ${id} is not the fisrt or last board in Array!`);
                return;
            }

            // If panel is in queued state, track in it first!
            if (unitMaterial.SystemState != 2) {
                // this.framework.logger.warning(`====== ${id} is in ${board.Step.Name} in MES, so we should trackOut first!`);
                await this.trackInWithoutResourceInfo(arrayName);
            }

            // accept all units' defects
            await this.acceptMaterialDefects(unitMaterails);

            if (defects.length > 0) {
                // FAIL
                //record defects & store all units' history
                await this.recordDefects(unitMaterails, defects, isPositiveSequence, resourceName, recordData, this.failFlag);
                // trackout from AOI step -> trackin to review step
                await this.trackOutWithNextLineFlowPath(arrayName, process);
                await this.trackInWithoutResourceInfo(arrayName);
            }
            else {
                // PASS
                // store all units' history
                let materialNames = [];
                for (let unit of unitMaterails) {
                    materialNames.push(unit.Name);
                }
                let result = await this.storageDatas(materialNames, resourceName, recordData, status);
                if (result) {
                    this.framework.logger.warning(`-----All datas of ${arrayName}'s units are storaged successfully.`);
                } else {
                    await this.reply(id, false, `Some datas are storaged failed`)
                    return;
                }
                // trackout from AOI step
                await this.trackOutWithNextLineFlowPath(arrayName, "UNLOAD");

                // track in to unload step -> track out from unload step
                await this.trackInWithoutResourceInfo(arrayName);
                await this.trackOut(arrayName);

                // Track out and move to buffer
                if (side == "TOP") {
                    // TOP side
                    // Lot track out and move to buffer
                    let sublot = unitMaterial.ParentMaterial.ParentMaterial;
                    let productionOrder = await this.getObjectByName(sublot.ProductionOrder.Name, "ProductionOrder");

                    let processedQuantity = Number(await this.loadObjectAttribute(productionOrder, "CustomProcessedQuantity"));
                    if (!processedQuantity || processedQuantity == null) processedQuantity = 0;

                    let newProcessedQuantity = processedQuantity + unitMaterial.ParentMaterial.SubMaterialCount;

                    this.framework.logger.warning(`====== processed quantity will be changed to: ${newProcessedQuantity}, production order quantity: ${productionOrder.Quantity}`);

                    // Array lot track out (sub lot)
                    if (sublot.Name != productionOrder.Name) {
                        sublot = await this.trackOut(sublot.Name);
                        if (!sublot || sublot == undefined) {
                            await this.reply(id, false, `Sub-lot: ${sublot.Name} track out failed!`)
                            return;
                        }
                        await this.framework.utils.ExecuteWithSystemErrorRetry(this.framework.logger, this.maxRetries, this.sleepBetweenRetries, async () => {
                            return (await this.framework.customApis.moveNext(this.framework, sublot));
                        });
                    }

                    // Lot partial track out
                    if (newProcessedQuantity > productionOrder.Quantity) {
                        await this.reply(id, false, `Processed quantity + Array quantity(${newProcessedQuantity}) is more than ProductionOrder quantity(${productionOrder.Quantity})!`)
                        return;
                    }
                    else if (newProcessedQuantity == productionOrder.Quantity) {
                        let mainLot = await this.getObjectByName(productionOrder.Name, "Material");

                        let lotOriQuantity = mainLot.PrimaryQuantity;
                        await this.framework.customApis.changeMaterialQuantity(this.framework, mainLot, 0);
                        mainLot = await this.trackOut(mainLot.Name);
                        await this.framework.customApis.changeMaterialQuantity(this.framework, mainLot, lotOriQuantity);

                        await this.framework.utils.ExecuteWithSystemErrorRetry(this.framework.logger, this.maxRetries, this.sleepBetweenRetries, async () => {
                            return (await this.framework.customApis.moveNext(this.framework, mainLot));
                        });
                    }
                    await this.changeAttribute(productionOrder.Name, "ProductionOrder", "CustomProcessedQuantity", newProcessedQuantity);
                }
                else {
                    // BOTTOM side
                    let sublot = unitMaterial.ParentMaterial.ParentMaterial;
                    let productionOrder = await this.getObjectByName(sublot.ProductionOrder.Name, "ProductionOrder");
                    let aoiReworkQuantity = Number(await this.loadObjectAttribute(productionOrder, "CustomAOIReworkQuantity"));
                    if (!aoiReworkQuantity || aoiReworkQuantity == null) aoiReworkQuantity = 0;
                    let newAOIReworkQuantity = aoiReworkQuantity;
                    // Check array lot type
                    if (sublot.Name != productionOrder.Name) {
                        // Sub-lot
                        let mainLot = await this.getObjectByName(productionOrder.Name, "Material");
                        if (mainLot.Step.Name == "SMT_BOTTOM") {
                            // Merge sub-lot to main-lot
                            await this.mergeMaterials(mainLot, sublot);
                            // change CustomAOIReworkQuantity
                            newAOIReworkQuantity = aoiReworkQuantity - unitMaterial.ParentMaterial.SubMaterialCount;
                            await this.changeAttribute(productionOrder.Name, "ProductionOrder", "CustomAOIReworkQuantity", newAOIReworkQuantity);
                        }
                    }
                    else {
                        // Main-lot
                        // do nothing
                    }

                    // change CustomProcessedQuantity
                    let processedQuantity = Number(await this.loadObjectAttribute(productionOrder, "CustomProcessedQuantity"));
                    if (!processedQuantity || processedQuantity == null) processedQuantity = 0;
                    let newProcessedQuantity = processedQuantity + unitMaterial.ParentMaterial.SubMaterialCount;
                    await this.changeAttribute(productionOrder.Name, "ProductionOrder", "CustomProcessedQuantity", newProcessedQuantity);

                    // Move to Buffer
                    let xraySamplingRule = await this.getXraySamplingRules("CustomXraySamplingRules", unitMaterial.Product.Name);
                    if (xraySamplingRule != undefined && xraySamplingRule != null) {
                        let smaplingQuantity = Number(xraySamplingRule["Quantity"]);
                        let smaplingPercent = Number(xraySamplingRule["Percent"]);
                        if ((smaplingQuantity && smaplingQuantity > 0) || (smaplingPercent && smaplingPercent > 0)) {
                            let inspectionFinished = await this.loadObjectAttribute(productionOrder, "CustomXrayInspectionFinished");
                            if (inspectionFinished && inspectionFinished == true) {
                                let sampingPercentQty = Math.ceil(smaplingPercent * productionOrder.Quantity / 100);
                                let sampledQty = Number(await this.loadObjectAttribute(productionOrder, "CustomXrayPassedQuantity"));
                                if ((sampledQty >= smaplingQuantity && sampledQty >= sampingPercentQty)) {
                                    // X-ray inspection finished, can do partial track out
                                    await this.partialTrackOut(unitMaterial.ParentMaterial.Name, false);
                                } else {
                                    // CustomXrayPassedQuantity does not arrive the quantitys configed in the rule
                                    this.framework.logger.warning(`Current array need to wait X-ray inspection, XrayPassedQuantity: ${sampledQty}, Rule-Qty: ${smaplingQuantity}, Rule-PercentQty: ${sampingPercentQty}`);
                                }
                            }
                            else {
                                // CustomXrayInspectionFinished==false
                                this.framework.logger.warning(`Current array need to wait X-ray inspection, CustomXrayInspectionFinished == false`);
                            }
                        } else {
                            // Rules check failed
                            this.framework.logger.error(`X-ray sampling rule does not config correctly, Quantity: ${xraySamplingRule["Quantity"]}, Percent: ${xraySamplingRule["Percent"]}`)
                        }
                    } else {
                        // Rules don't exit, can do partial track out
                        await this.partialTrackOut(unitMaterial.ParentMaterial.Name, false);
                    }

                    if (newProcessedQuantity == (productionOrder.Quantity - newAOIReworkQuantity)) {
                        // 20240327
                        // do nothing
                    }
                }
            }

            await this.reply(id, true);
        }
        catch (e) {
            await this.reply(id, false, e.message);
        }
    }

    public async mergeMaterials(mainMaterial: any, childMaterial: any): Promise<any> {
        const input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.MergeMaterialsInput();
        input.IgnoreLastServiceId = true;
        input.ToCopyFutureHolds = true;
        input.MainMaterial = mainMaterial;

        let childPanelMaterials = await this.getChildMaterials(childMaterial)

        input.ChildMaterials = new this.framework.LBOS.CMFMap();
        const panels = [];
        for (const panelMaterial of childPanelMaterials) {
            const mergeMaterialParameter = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MergeMaterialParameter();
            mergeMaterialParameter.SubMaterial = panelMaterial;
            panels.push(mergeMaterialParameter);
        }
        input.ChildMaterials.set(childMaterial, panels);

        const output = await this.framework.utils.ExecuteWithSystemErrorRetry(this.framework.logger, this.maxRetries, this.sleepBetweenRetries, async () => {
            return (await this.framework.system.call(input));
        });
        this.framework.logger.warning(`====== Child lot: ${childMaterial.Name} merge to main lot: ${mainMaterial.Name}, result: ${output.Message}`);
        return output.Message;
    }

    public async getChildMaterials(arrayMaterial: any): Promise<any> {
        // Get units by array
        const getsubMaterialIn = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects
            .GetMaterialChildrenWithContainersAsDataSetInput();
        getsubMaterialIn.Material = arrayMaterial;
        getsubMaterialIn.IgnoreLastServiceId = true;
        let getsubMaterialOut = await this.framework.system.call(getsubMaterialIn);
        return getsubMaterialOut.SubMaterialsWithContainers.T_Result;
    }

    // TrackIn without Resource Info
    public async trackInWithoutResourceInfo(materialName: string): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForMultipleTrackInWizardInput();
        input.IgnoreLastServiceId = true;
        input.MaterialLevelsToLoad = 2;
        input.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
        let material = await this.getObjectByName(materialName, "Material");
        input.Materials.push(material);
        input.Operation = 0;
        input.ResourceLevelsToLoad = 1;
        let output = await this.framework.system.call(input);

        if (output.Resources && output.Resources.length > 0) {
            let resource = output.Resources[0];

            let trackininput = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexTrackInMaterialsInput();
            trackininput.IgnoreLastServiceId = true;
            trackininput.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
            trackininput.Materials.push(material);
            trackininput.Resource = resource;

            let trackinoutput = await this.customSystemCall(this.framework, trackininput);
            this.framework.logger.warning(`====== array: ${materialName}, step: ${material.Step.Name}, trackinoutput: ${trackinoutput.Message}`);
        }
    }

    public async trackOutWithNextLineFlowPath(materialName: string, process: string) {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexTrackOutMaterialsInput();
        input.IgnoreLastServiceId = true;
        input.Material = new this.framework.LBOS.CMFMap();
        let material = await this.getObjectByName(materialName, "Material");
        let trackOutParam = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.ComplexTrackOutParameters();
        let nextStepsResults = await this.getDataForMultipleTrackOutAndMoveNextWizard(material);
        for (let item of nextStepsResults) {
            if (item.LogicalFlowPath.includes(process)) {
                trackOutParam.NextLineFlowPath = item.FlowPath;
            }
        }
        trackOutParam.SkipDCValidation = false;
        input.Material.set(material, trackOutParam);
        let output = await this.customSystemCall(this.framework, input);
        this.framework.logger.warning(`------ array: ${materialName}, trackOutWithNextLineFlowPath Output: ${output.Message}, NextLineFlowPath: ${trackOutParam.NextLineFlowPath}`);
    }

    public async getDataForMultipleTrackOutAndMoveNextWizard(material: any): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForMultipleTrackOutAndMoveNextWizardInput();
        input.BinningTreeLevelsToLoad = 0;
        input.ChecklistLevelsToLoad = 0;
        input.DataCollectionInstanceLevelsToLoad = 0;
        input.IsToLoadLossMultimedia = false;
        input.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
        input.Materials.push(material);
        input.Operation = 0;
        input.ResourceLevelsToLoad = 0;
        input.TopMostMaterialLevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        return output.NextStepsResults;
    }

    private async partialTrackOut(materialName: any, isLot: boolean): Promise<any> {
        let material = await this.framework.customApis.getObjectByName(this.framework, materialName, "Material", 2);
        if (material) {
            this.framework.logger.warning(`------ material: ${material.Name}, isLot: ${isLot}`);
            let trackOutInput = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexTrackOutMaterialsInput();
            trackOutInput.IgnoreLastServiceId = true;
            trackOutInput.Material = new this.framework.LBOS.CMFMap();

            let trackOutParameters = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.ComplexTrackOutParameters();
            trackOutParameters.IsToSkipQuantityOverrideValidation = true;
            trackOutParameters.SkipDCValidation = false;
            trackOutParameters.SplitAndTrackOutParameters = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.SplitInputParameters();
            trackOutParameters.SplitAndTrackOutParameters.PrimaryQuantity = 0;
            // this.framework.logger.warning(`====== trackOutParameters.SplitAndTrackOutParameters.PrimaryQuantity: ${trackOutParameters.SplitAndTrackOutParameters.PrimaryQuantity}`);
            trackOutParameters.SplitAndTrackOutParameters.SubMaterials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.SplitInputSubMaterialCollection();
            trackOutParameters.TerminateOnZeroQuantity = true;

            if (!isLot) {
                // Array
                let submaterialitem = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.SplitInputSubMaterial();
                submaterialitem.SubMaterial = material;
                trackOutParameters.SplitAndTrackOutParameters.SubMaterials.push(submaterialitem);
                trackOutInput.Material.set(material.ParentMaterial, trackOutParameters);
            }
            else {
                // Lot
                trackOutInput.Material.set(material, trackOutParameters);
            }

            let trackOutOutput = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.OutputObjects.ComplexTrackOutMaterialsOutput();
            trackOutOutput = await this.customSystemCall(this.framework, trackOutInput);
            this.framework.logger.warning(`------ partialTrackOut result: ${trackOutOutput.Message}`);

            for (let item of trackOutOutput.Materials.keys()) {
                this.framework.logger.warning(`------ sublot name: ${item.Name}`);
                return item;
            }
        }
        return undefined;
    }

    /**
     * Record defects
     * @param materialName material name of array
     * @param defects defect list
     */
    public async recordDefects(unitMaterails: any, defects: any, isPositiveSequence: boolean, resourceName: string, recordData: any, status: string): Promise<any> {
        this.framework.logger.warning(`------ 00 defects.length: ${defects.length}`);

        // Panel with one unit
        if (unitMaterails.length == 1) {
            let result = unitMaterails[0];
            this.framework.logger.warning(`------ 01 unit: ${result.Name}`);

            let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.RecordMaterialDefectsInput();
            input.Material = await this.getObjectByName(result.Name, "Material");
            input.MaterialDefects = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectCollection();

            for (let [index, item] of defects.entries()) {
                let defectdetails = item.split(',');

                let materialdefect = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefect();
                materialdefect.DefectSource = 2;
                materialdefect.DefectType = 0;
                materialdefect.OpenRemark = `DefectIndex: ${index},\nInspectionResult: ${item}`; // defectdetails[0];
                materialdefect.Reason = await this.getObjectByName(defectdetails[2], "Reason");
                materialdefect.ReferenceDesignator = defectdetails[1];

                input.MaterialDefects.push(materialdefect);
            }

            let output = await this.customSystemCall(this.framework, input);
            this.framework.logger.warning(`------ unit: ${result.Name}, recordDefects: ${output.Message}, MaterialDefects' count: ${input.MaterialDefects.length}`);
            recordData.push(["status", this.failFlag]);
            let res = await this.storageData(result.Name, resourceName, recordData, this.failFlag);
            if (res) {
                this.framework.logger.warning(`-----All datas of ${result.Name} are storaged successfully.`);
            } else {
                this.framework.logger.error(`-----Some datas of ${result.Name} are storaged failed.`);
            }
        }
        //Panel with muti units
        else {
            for (const result of unitMaterails) {
                this.framework.logger.warning(`------ 01 unit: ${result.Name}`);

                let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.RecordMaterialDefectsInput();
                input.Material = await this.getObjectByName(result.Name, "Material");
                input.MaterialDefects = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectCollection();

                //Number(result.Name.substr(result.Name.length - 2, 2));
                let unitIndex = Number(await this.loadObjectAttribute(input.Material, "CustomMapIndex"));
                this.framework.logger.warning(`------ 02 unitIndex: ${unitIndex}`);

                let unitRecordData = [];
                let unitStatus = this.passFlag;
                for (let recorditem of recordData) {
                    if (recorditem[0] != "defect") { // && recorditem[0] != "status"
                        unitRecordData.push(recorditem)
                    }
                }

                for (let [index, item] of defects.entries()) {
                    let defectdetails = item.split(',');
                    let unitDefectPositions = defectdetails[1].split(':');
                    this.framework.logger.warning(`====== unitDefectPositions[0]: ${unitDefectPositions[0]}`);

                    let defectPos = Number(unitDefectPositions[0]);
                    // If defect's position is not in positive sequence, reverse it
                    if (!isPositiveSequence) {
                        defectPos = unitMaterails.length + 1 - defectPos;
                    }
                    if (defectPos == unitIndex || (unitDefectPositions.length == 1 && unitIndex == 1)) {
                        let materialdefect = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefect();
                        materialdefect.DefectSource = 2;
                        materialdefect.DefectType = 0;
                        materialdefect.OpenRemark = `DefectIndex: ${index},\nInspectionResult: ${item}`; // defectdetails[0];
                        materialdefect.Reason = await this.getObjectByName(defectdetails[2], "Reason");
                        materialdefect.ReferenceDesignator = unitDefectPositions[unitDefectPositions.length - 1];

                        input.MaterialDefects.push(materialdefect);
                        unitRecordData.push(["defect", item]);
                        unitStatus = this.failFlag;
                    }
                }
                if (input.MaterialDefects.length > 0) {
                    let output = await this.customSystemCall(this.framework, input);
                    this.framework.logger.warning(`------ unit: ${result.Name}, recordDefects: ${output.Message}, MaterialDefects' count: ${input.MaterialDefects.length}`);
                }
                unitRecordData.push(["status", unitStatus]);
                let res = await this.storageData(result.Name, resourceName, unitRecordData, unitStatus);
                if (res) {
                    this.framework.logger.warning(`-----All datas of ${result.Name} are storaged successfully.`);
                } else {
                    this.framework.logger.error(`-----Some datas of ${result.Name} are storaged failed.`);
                }
            }
        }
    }

    public async acceptMaterialDefects(unitMaterails: any) {
        // Select unit related to action by id
        for (const result of unitMaterails) {
            // this.framework.logger.warning(`------ unit: ${result.Name}`);
            // Get opened defect list filtered by unit name and defect position
            // OpenDefectCount
            let query = await this.getMaterialDefectsQuery(result.Name);
            let materialDefectList = await this.executeQuery(query);
            if (materialDefectList && materialDefectList.length > 0) {
                let unitMaterialWithDefect = await this.getObjectByName(result.Name, "Material");
                let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ManageMaterialDefectsInput();
                input.IgnoreLastServiceId = true;
                input.Material = unitMaterialWithDefect;
                input.MaterialDefects = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectCollection();

                for (let item of materialDefectList) {
                    this.framework.logger.warning(`------ 06 materialDefectItem: ${JSON.stringify(item)}`);
                    // item.Id; Material Defect Id
                    // item.Name; Material Defect Name
                    // item.ReasonName; Defect Reason Name
                    // item.ReferenceDesignator; Defect Position
                    let materialDefect = await this.getObjectByName(item.Name, "MaterialDefect");
                    materialDefect.SystemState = 2;// 0:Open, 1: Fixed, 2: False 3: Accepted, 4: Not Fixable
                    materialDefect.CloseRemark = "AOI online re-test finished";
                    input.MaterialDefects.push(materialDefect);
                }
                let output = await this.customSystemCall(this.framework, input);
                this.framework.logger.warning(`------ unit: ${unitMaterails[0].Name},  acceptMaterialDefects: ${output.Message}`);
            }
        }
    }

    public async executeQuery(query: any): Promise<any> {
        try {
            let input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.QueryManagement.InputObjects.ExecuteQueryInput();
            input.QueryObject = query;
            let output = await this.framework.system.call(input);
            if (output.NgpDataSet && output.NgpDataSet["T_Result"]) {
                return output.NgpDataSet["T_Result"];
            }
        } catch (ex) {
            this.framework.logger.error(ex.Message);
            return undefined;
        }
    }

    public async getMaterialDefectsQuery(materialName: string): Promise<any> {
        const filterCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FilterCollection();

        // Filter filter_0
        const filter_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter_0.Name = "Name";
        filter_0.ObjectName = "Material";
        filter_0.ObjectAlias = "MaterialDefect_Material_2";
        filter_0.Operator = this.framework.LBOS.Cmf.Foundation.Common.FieldOperator.IsEqualTo;
        filter_0.Value = materialName;
        filter_0.LogicalOperator = this.framework.LBOS.Cmf.Foundation.Common.LogicalOperator.AND;
        filter_0.FilterType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.FilterType.Normal;

        // Filter filter_1
        const filter_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter_1.Name = "SystemState";
        filter_1.ObjectName = "MaterialDefect";
        filter_1.ObjectAlias = "MaterialDefect_1";
        filter_1.Operator = this.framework.LBOS.Cmf.Foundation.Common.FieldOperator.IsEqualTo;
        filter_1.Value = this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectSystemState.Open;
        filter_1.LogicalOperator = this.framework.LBOS.Cmf.Foundation.Common.LogicalOperator.Nothing;
        filter_1.FilterType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.FilterType.Normal;

        filterCollection.push(filter_0);
        filterCollection.push(filter_1);

        const fieldCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FieldCollection();

        // Field field_0
        const field_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_0.Alias = "Id";
        field_0.ObjectName = "MaterialDefect";
        field_0.ObjectAlias = "MaterialDefect_1";
        field_0.IsUserAttribute = false;
        field_0.Name = "Id";
        field_0.Position = 0;
        field_0.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_1
        const field_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_1.Alias = "Name";
        field_1.ObjectName = "MaterialDefect";
        field_1.ObjectAlias = "MaterialDefect_1";
        field_1.IsUserAttribute = false;
        field_1.Name = "Name";
        field_1.Position = 1;
        field_1.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_2
        const field_2 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_2.Alias = "ReferenceDesignator";
        field_2.ObjectName = "MaterialDefect";
        field_2.ObjectAlias = "MaterialDefect_1";
        field_2.IsUserAttribute = false;
        field_2.Name = "ReferenceDesignator";
        field_2.Position = 2;
        field_2.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_3
        const field_3 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_3.Alias = "ReasonName";
        field_3.ObjectName = "Reason";
        field_3.ObjectAlias = "MaterialDefect_Reason_2";
        field_3.IsUserAttribute = false;
        field_3.Name = "Name";
        field_3.Position = 3;
        field_3.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        fieldCollection.push(field_0);
        fieldCollection.push(field_1);
        fieldCollection.push(field_2);
        fieldCollection.push(field_3);


        const relationCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.RelationCollection();

        // Relation relation_0
        const relation_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Relation();
        relation_0.Alias = "";
        relation_0.IsRelation = false;
        relation_0.Name = "";
        relation_0.SourceEntity = "MaterialDefect";
        relation_0.SourceEntityAlias = "MaterialDefect_1",
            relation_0.SourceJoinType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.JoinType.InnerJoin;
        relation_0.SourceProperty = "MaterialId";
        relation_0.TargetEntity = "Material";
        relation_0.TargetEntityAlias = "MaterialDefect_Material_2";
        relation_0.TargetJoinType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.JoinType.InnerJoin;
        relation_0.TargetProperty = "Id";

        // Relation relation_1
        const relation_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Relation();
        relation_1.Alias = "";
        relation_1.IsRelation = false;
        relation_1.Name = "";
        relation_1.SourceEntity = "MaterialDefect";
        relation_1.SourceEntityAlias = "MaterialDefect_1",
            relation_1.SourceJoinType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.JoinType.InnerJoin;
        relation_1.SourceProperty = "ReasonId";
        relation_1.TargetEntity = "Reason";
        relation_1.TargetEntityAlias = "MaterialDefect_Reason_2";
        relation_1.TargetJoinType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.JoinType.InnerJoin;
        relation_1.TargetProperty = "Id";

        relationCollection.push(relation_0);
        relationCollection.push(relation_1);

        const query = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.QueryObject();
        query.Description = "";
        query.EntityTypeName = "MaterialDefect";
        query.Name = "CustomGetMaterialDefects";
        query.Query = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Query();
        query.Query.Distinct = false;
        query.Query.Filters = filterCollection;
        query.Query.Fields = fieldCollection;
        query.Query.Relations = relationCollection;

        return query;
    }

    public async loadObjectAttribute(entity: any, attributeName: string): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.GenericServiceManagement.InputObjects.LoadObjectAttributesInput();
        input.Entity = entity;
        input.IgnoreLastServiceId = true;
        let output = await this.framework.system.call(input);
        let attributeValue = output.Entity.Attributes.get(attributeName);
        return attributeValue;
    }

    /**
     * Change Attribute of an object
     * @param objectlName object Name
     * @param objectType object Type
     * @param attributeKey attribute Key
     * @param attributeValue attribute Value
     */
    public async changeAttribute(objectlName: string, objectType: string, attributeKey: string, attributeValue: any): Promise<any> {
        const input = new (await this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.GenericServiceManagement.InputObjects.FullUpdateObjectInput)();
        input.IgnoreLastServiceId = true;

        const paras = new (await this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.FullUpdateParameters)();
        paras.AttributesToAddOrUpdate = new this.framework.LBOS.CMFMap();
        paras.AttributesToAddOrUpdate.set(attributeKey, attributeValue);
        input.FullUpdateParameters = paras;

        input.Object = await this.getObjectByName(objectlName, objectType);

        await this.customSystemCall(this.framework, input);
        this.framework.logger.warning(`============ change ${objectType} ${objectlName}  Attribute ${attributeKey}: ${attributeValue} `);
    }

    /**
     * Track out
     * @param materialName material name of array
     */
    public async trackOut(materialName: string) {
        // this.framework.logger.warning("====== trackOut!!!")
        const input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexTrackOutMaterialsInput();
        input.IgnoreLastServiceId = true;

        input.Material = new this.framework.LBOS.CMFMap();
        const material = await this.getObjectByName(materialName, "Material");
        input.Material.set(material, new this.framework.LBOS.Cmf.Navigo.BusinessObjects.ComplexTrackOutParameters);

        const trackoutput = await this.customSystemCall(this.framework, input);
        this.framework.logger.warning(`------ array: ${materialName}, step: ${material.Step.Name}, trackoutOutput: ${trackoutput.Message}`);
        for (let key of trackoutput.Materials.keys()) {
            return key;
        }
        throw new Error(`There isn't any material be performed trackout!`);
    }

    /**
     * Get unit material from mes by unit id
     * @param id the id of unit material
     */
    public async getUnitMaterial(id: string): Promise<any> {
        let unitMaterial = await this.getObjectByName(id, "Material", 3);
        if (unitMaterial) {
            if (unitMaterial.ParentMaterial) {
                this.framework.logger.warning(`------ unit loaded: ${unitMaterial.Name}, array: ${JSON.stringify(unitMaterial.ParentMaterial.Name)}`);
                return unitMaterial;
            } else {
                this.framework.logger.error(`Unit: ${id}'s parent Array doesn't exist!`);
                return undefined;
            }
        }
        else {
            this.framework.logger.error(`Unit: ${id} doesn't exist!`);
            return undefined;
        }
    }

    /**
     * Get a system object from an id
     * @param name Name of the object
     * @param type Type of the object
     * @param levelsToLoad Levels to Load (defaults to 0)
     */
    public async getObjectByName(name: string, type: string, levelsToLoad?: number): Promise<any> {
        levelsToLoad = levelsToLoad || 0;

        try {
            const input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.GenericServiceManagement.InputObjects.GetObjectByNameInput();
            input.Name = name;
            input.LevelsToLoad = levelsToLoad;
            input.Type = type;

            const res = await this.framework.system.call(input);
            return (res.Instance);
        } catch (e) {
            return undefined;
        }
    }

    public async changeFlowStep(material: any, flowPath: string, step: string): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ChangeMaterialFlowAndStepInput();
        input.Flow = material.Flow;
        input.FlowPath = flowPath;
        input.IgnoreLastServiceId = true;
        input.Material = material;
        input.Step = await this.getObjectByName(step, "Step");
        let output = await this.customSystemCall(this.framework, input);
    }

    public async changeNearbyStep(material: any, stepName: string): Promise<any> {
        let array = material.FlowPath.split(":");
        let flowStepNum = array[array.length - 1];
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.FacilityManagement.FlowManagement.InputObjects.LoadFlowChildsInput();
        input.Flow = material.Flow;
        input.LevelsToLoad = 1;
        let output = await this.customSystemCall(this.framework, input);
        let correlationID = 0;

        for (let flowStep of output.Flow.FlowSteps) {
            if (flowStep.TargetEntity.Name == stepName) {
                correlationID = flowStep.CorrelationID;
                break;
            }
        }

        let lastFlowPath = `${material.FlowPath.split("/")[0]}/${stepName}:${correlationID}`;
        await this.changeFlowStep(material, lastFlowPath, stepName);
    }

    public async reply(id: string, res: boolean, msg?: string | "") {
        let msg1 = "";
        if (msg && msg.length > 0) msg1 = `|msg=${msg}`;
        // if (msg.length>0) msg = `|msg=${msg}`;
        if (res) {
            this.outputs.replyContent.emit(`BACK|id=${id}|status=PASS${msg1}\n`);
            this.framework.logger.warning(`====== reply: BACK|id=${id}|status=PASS${msg1}`);
        }
        else {
            this.outputs.replyContent.emit(`BACK|id=${id}|status=FAIL${msg1}\n`);
            this.framework.logger.error(`====== reply: BACK|id=${id}|status=FAIL${msg1}`);
        }
    }

    private async storageData(materialName: string, resourceName: string, data: any, status: string): Promise<any> {
        // Do data collection
        this.outputs.material.emit({ Name: materialName });
        this.outputs.resource.emit({ Name: resourceName });
        if (status == this.passFlag) {
            this.outputs.passFail.emit("Pass");
        } else {
            this.outputs.passFail.emit("Fail");
            status = this.reworkFlag;
        }

        // Storage data
        let serviceInput: any = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.BaseInput();
        serviceInput["$type"] = "Cmf.Custom.BorgWarnerSuzhou.Orchestration.InputObjects.CustomUnitDataInfoReportedByIoTInput, Cmf.Custom.BorgWarnerSuzhou.Orchestration";
        serviceInput.IgnoreLastServiceId = true;
        serviceInput.NumberOfRetries = 10;
        serviceInput["constructor"] = {
            "_CMFInternal_HTTPMethod": "POST",
            "_CMFInternal_URLSuffix": "api/BorgWarnerSuzhou/CustomUnitDataInfoReportedByIoT"
        };

        serviceInput["MaterialName"] = materialName;
        serviceInput["ResourceName"] = resourceName;
        serviceInput["Status"] = status;
        serviceInput["DataInfo"] = data;

        const result = await this.customSystemCall(this.framework, serviceInput);
        return result;
    }

    private async storageDatas(materialNames: any, resourceName: string, data: any, status: string): Promise<any> {
        // Do data collection
        this.outputs.batchPassFail.emit({
            materialNames: materialNames,
            resourceName: resourceName,
            status: status
        })

        if (status != this.passFlag) {
            status = this.reworkFlag;
        }

        // Storage datas
        let serviceInput: any = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.BaseInput();
        serviceInput["$type"] = "Cmf.Custom.BorgWarnerSuzhou.Orchestration.InputObjects.CustomMutiUnitDataInfoReportedByIoTInput, Cmf.Custom.BorgWarnerSuzhou.Orchestration";
        serviceInput.IgnoreLastServiceId = true;
        serviceInput.NumberOfRetries = 10;
        serviceInput["constructor"] = {
            "_CMFInternal_HTTPMethod": "POST",
            "_CMFInternal_URLSuffix": "api/BorgWarnerSuzhou/CustomMutiUnitDataInfoReportedByIoT"
        };

        serviceInput["MaterialNames"] = materialNames;
        serviceInput["ResourceName"] = resourceName;
        serviceInput["Status"] = status;
        serviceInput["DataInfo"] = data;

        const result = await this.customSystemCall(this.framework, serviceInput);
        return result;
    }

    private async autoTrackinMutiSteps(material: any, desStep: any, subResourceName: any): Promise<any> {
        let serviceInput: any = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.BaseInput();
        serviceInput["$type"] = "Cmf.Custom.BorgWarnerSuzhou.Orchestration.InputObjects.CustomAutoTrackinMutilStepsByIoTInput, Cmf.Custom.BorgWarnerSuzhou.Orchestration";
        serviceInput.IgnoreLastServiceId = true;
        serviceInput.NumberOfRetries = 10;
        serviceInput["constructor"] = {
            "_CMFInternal_HTTPMethod": "POST",
            "_CMFInternal_URLSuffix": "api/BorgWarnerSuzhou/CustomAutoTrackinMutilStepsByIoT"
        };

        serviceInput["material"] = material;
        serviceInput["desStep"] = desStep;
        serviceInput["subResource"] = subResourceName;

        const result = await this.customSystemCall(this.framework, serviceInput);
        return result;
    }

    public async customSystemCall(framework: any, input: any, settings?: any): Promise<any> {
        settings = settings || { maxRetries: 10, sleepBetweenRetries: 400 };
        const res = await this.ExecuteWithSystemErrorRetry(framework, settings.maxRetries, settings.sleepBetweenRetries, async () => {
            return (await framework.system.call(input));
        });
        return res;
    }

    /**
     * Perform an action with some retry logic while *some* specific Mes System errors happen
     * @param logger Logger object to use
     * @param attempts Number of attempts to perform
     * @param sleepBetweenAttempts Interval to wait between attempts
     * @param code Code to execute
     */
    public async ExecuteWithSystemErrorRetry(framework: any, attempts: number, sleepBetweenAttempts: number, code: Function): Promise<any> {
        let current: number = 1;
        let lastError: Error | undefined;
        do {
            try {
                lastError = undefined;

                const res = await code(current, attempts);

                if (res != null) {
                    return (res);
                }
            } catch (error) {
                lastError = error;
                framework.logger.debug(`<< During attempt #${current}/${attempts}, operation failed: ${error.message}`);

                // Only retry on one of the following errors:
                const errorMessage = error.message.toString();
                const isChangedSinceLast = errorMessage.indexOf("The data for object") !== -1 &&
                    errorMessage.indexOf("has changed since last viewed. Please refresh the object.") !== -1;
                const isDeadLocked = errorMessage
                    .indexOf("was deadlocked on lock resources with another process and has been chosen as the deadlock victim") !== -1;
                const isMesBug = errorMessage.indexOf("The number of associated ") !== -1 &&
                    errorMessage.indexOf("does not match the number of UsedPositions") !== -1;
                const isHostDown = errorMessage.indexOf("connect ECONNREFUSED ") !== -1;

                if (isChangedSinceLast || isDeadLocked || isMesBug || isHostDown) {
                    await framework.utils.sleep(sleepBetweenAttempts);
                } else {
                    current = attempts + 1; // Finish attempts
                }
            }

            current++;
        } while (lastError != null && current <= attempts);

        if (lastError != null) {
            throw lastError;
        }
    }


    public async doDataCollection(msg: any, materials: any, linkedEntityName: string): Promise<any> {
        // Add code here
        let jsonReceived: any = msg;
        // let jsonReceived: any = JSON.parse(inputs.jsonReceived);

        const msgFDF: string = jsonReceived.name;
        let errorMsg: string = "";
        // collected data that will be sent to DC
        let params: any = {};
        let dcName: string = "";
        let materialName: string = "";

        const configurationTable: string = "IoTFDFDataCollectionDefs";
        const persistedAlias = "IoTFDFDataCollectionDefsPersisted";
        const contextTableKeys = new Map<string, any>();

        contextTableKeys.set("Resource", linkedEntityName);
        const mapping: Array<any> = await this.framework.customUtilities.resolveSmartTable(this.framework, contextTableKeys, null, persistedAlias, configurationTable);
        this.framework.logger.info("Reading " + configurationTable);
        if (mapping !== undefined) {
            for (const row of mapping) {
                // check first if fdf message is of the same type
                const _FDFMessage: string = row["FDFMessage"];
                if (_FDFMessage != null) {
                    if (_FDFMessage.trim() == msgFDF.trim()) {
                        // fill parameter object to send to DC
                        if (row["DCName"] != null) {
                            dcName = row["DCName"].toString().trim()
                        }
                        const variableName = row["FDFVariable"].toString().trim();
                        const paramName = row["DCParameter"].toString().trim();
                        let jsonvars: varsOnFDF[] = jsonReceived.variables;
                        for (let jsonvar of jsonvars) {
                            jsonvar.name = jsonvar.name.trim();
                            jsonvar.value = jsonvar.value.trim();
                            if (jsonvar.name == variableName) {
                                if (params[paramName] == undefined) {
                                    params[paramName] = [jsonvar.value];
                                }
                                else {
                                    params[paramName].push(jsonvar.value);
                                }
                            }
                            if (jsonvar.name == "id") {
                                materialName = jsonvar.value;
                            }
                        }
                    }
                }
            }
        }
        if (materialName == "") {
            return { errorMessage: "Undefined Material" };
        }
        let material = { Name: materialName };
        let resource = { Name: linkedEntityName };
        // if params was populated, we process it
        if (Object.keys(params).length != 0) {
            // in the case of existing PassFail parameter, will correct to exact MES words : Pass, Fail
            if (params.PassFail != undefined) {
                if (params.PassFail.toString().toLowerCase() == "pass")
                    params.PassFail = "Pass";
                else
                    params.PassFail = "Fail";
            }
            //if there is a DC defined, used it at DataCollectionTask; if not, do not emit and let DataCollectionTask resolve the DC name
            //this.framework.logger.error(JSON.stringify(jsonReceived));
            if (dcName != "") {
                let dc = { Name: dcName };
                this.framework.logger.info("Collected Data to Post: " + JSON.stringify(params) + "; DataCollection: " + dcName);
                return { materialObject: material, resourceObject: resource, dataToCollect: params, jsonOutput: JSON.stringify(jsonReceived), dataCollection: dc, errorMessage: errorMsg, doCollectData: true };
            } else {
                this.framework.logger.info("Collected Data to Post: " + JSON.stringify(params) + "; DataCollection: Resolved by Context");
                return { materialObject: material, resourceObject: resource, dataToCollect: params, jsonOutput: JSON.stringify(jsonReceived), errorMessage: errorMsg, doCollectData: true };
            }
        }
        else {
            this.framework.logger.info("No matching data to collect.");
            return { materialObject: material, errorMessage: "" };
        }
    }

    public async getXraySamplingRules(tableName: string, productName: string): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.TableManagement.InputObjects.LoadSmartTableRowsWithoutChangesInput();
        input.SmartTable = await this.getSmartTableByName(tableName);
        input.Filters = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FilterCollection();

        let filter0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter0.LogicalOperator = 1;
        filter0.Name = "Product";
        filter0.ObjectName = "Product";
        filter0.Operator = 0;
        filter0.Value = productName;

        input.Filters.push(filter0);
        input.SortingObjectCollection = [];

        let output = await this.framework.system.call(input);
        let smartTable = output.SmartTable;
        let dataTable = smartTable.Data[`T_ST_${tableName}`];
        for (let row of dataTable) {
            this.framework.logger.warning(`Quantity: ${row["Quantity"]}, Percent: ${row["Percent"]}`);
            return row;
        }
        return undefined;
    }

    public async getSmartTableByName(tableName: string): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.TableManagement.InputObjects.GetSmartTableByNameInput();
        input.SmartTableName = tableName;
        input.LoadData = false;
        let output = await this.framework.system.call(input);
        if (output) {
            return output.SmartTable;
        }
        else {
            return undefined;
        }
    }
}

export interface varsOnFDF {
    name: string,
    value: string
}
