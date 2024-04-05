import { Framework } from 'framework';

export default class {

    /** Allows accessing external functions */
    private framework: Framework;
    private outputs: any;

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
                await this.HandleBCMP(msg);
            }

        } catch (e) {
            this.framework.logger.error(`Error while Handling BCMP: ${e.message}`);
            this.outputs.msg.emit(e.message);
        }
    }

    /**
     * BCMP message process
     * @param msg an object contains parsed parameters from BCMP message
     */
    public async HandleBCMP(msg: any) {
        let id = "";
        let process = "";
        let station = "";
        let status = "";
        let actions = [];

        let board = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.Material();
        let resName = await this.framework.dataStore.retrieve('ResourceName', 'Unknown');

        for (let item of msg.variables) {
            // this.framework.logger.warning(`------ ${item.name}: '${item.value}'`)
            if (item.name == "id") {
                id = item.value;
                this.outputs.id.emit(id);
            }
            if (item.name == "process") {
                process = item.value;
            }
            if (item.name == "station") {
                station = item.value;
                if (station != msg.entity) {
                    await this.replyBACK(id, false);
                    this.framework.logger.error(`====== Incorrect Station! MES resource instance name: ${msg.entity}, FDF station: ${station}`);
                    return;
                }
            }
            if (item.name == "status") {
                status = item.value;
            }
            if (item.name == "action") {
                actions.push(item.value);
            }
        }
        await this.storageData(id, resName, [], status);
        board = await this.getObjectByName(id, "Material", 2);
        if (!board) {
            this.framework.logger.error(`====== ${id} is not found in MES`);
            await this.replyBACK(id, false);
            return;
        }

        let panelMaterial = await this.getArrayMaterialByUnitId(id);
        if (!panelMaterial) {
            this.framework.logger.error(`====== Can not find Board ${id}'s Array in MES!`);
            await this.replyBACK(id, false);
            return;
        }

        if ((!board.Step.Name.includes(process))) {
            this.framework.logger.error(`====== Incorrect process! ${id} is in ${board.Step.Name} in MES.`);
            return;
        }

        if (panelMaterial.SystemState != 3) {
            await this.replyBACK(id, false);
            this.framework.logger.error(`====== ${panelMaterial.Name}'s System State is not Processed.`);
            return;
        }
        // attenetion to last resource
        let lastResource = panelMaterial.LastProcessedResource;
        let lastResName = await this.loadObjectAttribute(lastResource, "CustomFormerModelName");

        if (lastResName == station) {
        } else {
            await this.moveNexts(panelMaterial.Name, true);
            let resource = await this.getObjectByName(resName, "Resource");
            panelMaterial = await this.getObjectByName(panelMaterial.Name, "Material");
            await this.dispatchAndTrackIn(panelMaterial, resource);
            await this.trackOut(panelMaterial.Name);
        }
        // await this.moveNexts(panelMaterial.Name, true);
        // let resource = await this.getObjectByName(resName, "Resource");
        // panelMaterial = await this.getObjectByName(panelMaterial.Name, "Material");
        // await this.dispatchAndTrackIn(panelMaterial, resource);
        // await this.trackOut(panelMaterial.Name);

        if (status == "PASS") {
            if (actions.length > 0) {
                await this.manageMaterialDefects(board.Name, actions, 3);
            }
            await this.replyBACK(id, true);
            return;
        } else if (status == "FAIL") {
            // if (actions.length > 0) {
            //     // await this.manageMaterialDefects(board.Name, actions, 0);
            // }
            await this.replyBACK(id, true);
            return;
        }

        // Exeption
        await this.replyBACK(id, false);
        this.framework.logger.error
            (`====== ${id} Unexpected Exeption occured!`);
        return;
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

            let trackinoutput = await this.framework.system.call(trackininput);
            this.framework.logger.warning(`====== trackinoutput: ${trackinoutput.Message}`);
        }
    }

    public async trackOutWithNextLineFlowPath(materialName: string, optional: boolean) {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexTrackOutMaterialsInput();
        input.IgnoreLastServiceId = true;
        input.Material = new this.framework.LBOS.CMFMap();
        let material = await this.getObjectByName(materialName, "Material");
        let trackOutParam = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.ComplexTrackOutParameters();
        let nextStepsResults = await this.getDataForMultipleTrackOutAndMoveNextWizard(material);
        if (optional) {
            for (let item of nextStepsResults) {
                if (item.IsOptional == true) {
                    trackOutParam.NextLineFlowPath = item.FlowPath;
                    this.framework.logger.debug(`go to optional step ${item.FlowPath}`);
                    break;
                }
            }
        }
        else {
            for (let item of nextStepsResults) {
                if (item.IsOptional == false) {
                    trackOutParam.NextLineFlowPath = item.FlowPath;
                    break;
                }
            }
        }
        trackOutParam.SkipDCValidation = false;
        input.Material.set(material, trackOutParam);
        let output = await this.framework.system.call(input);
        this.framework.logger.warning(`------ array: ${materialName}, trackOutWithNextLineFlowPath Output: ${output.Message}`);
    }

    public async getDataForMultipleTrackOutAndMoveNextWizard(material: any): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForMultipleTrackOutAndMoveNextWizardInput();
        input.BinningTreeLevelsToLoad = 1;
        input.ChecklistLevelsToLoad = 1;
        input.DataCollectionInstanceLevelsToLoad = 1;
        input.MaterialLevelsToLoad = 1;
        input.IsToLoadLossMultimedia = false;
        input.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
        input.Materials.push(material);
        input.Operation = 0;
        input.ResourceLevelsToLoad = 1;
        input.TopMostMaterialLevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        // this.framework.logger.warning(`======= NextStepsResults: ${output.NextStepsResults[0].FlowPath}`);
        return output.NextStepsResults;
    }

    /**
     * Record defects
     * @param materialName material name of array
     * @param defectRemarks defect remark list
     */
    public async recordDefects(materialName: string, defectRemarks: any, reasonName: string): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.RecordMaterialDefectsInput();
        input.Material = await this.getObjectByName(materialName, "Material");
        input.MaterialDefects = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectCollection();

        for (let item of defectRemarks) {
            let materialdefect = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefect();
            materialdefect.DefectSource = 2;
            materialdefect.DefectType = 0;
            materialdefect.OpenRemark = item;
            materialdefect.Reason = await this.getObjectByName(reasonName, "Reason");

            input.MaterialDefects.push(materialdefect);
        }
        if (input.MaterialDefects.length > 0) {
            let output = await this.framework.system.call(input);
            this.framework.logger.warning(`------ array: ${materialName}, unit: ${materialName}, recordDefects: ${output.Message}, MaterialDefects' count: ${input.MaterialDefects.length}`);
        }
    }

    public async loadObjectAttribute(entity: any, attributeName: string): Promise<any> {
        try {
            let input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.GenericServiceManagement.InputObjects.LoadObjectAttributesInput();
            input.Entity = entity;
            input.IgnoreLastServiceId = true;
            let output = await this.framework.system.call(input);
            let attributeValue = output.Entity.Attributes.get(attributeName);
            return attributeValue;
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Change Attribute of an object
     * @param object object
     * @param attributeKey attribute Key
     * @param attributeValue attribute Value
     */
    public async updateObjectAttribute(object: any, attributeKey: string, attributeValue: any): Promise<any> {
        const input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.GenericServiceManagement.InputObjects.FullUpdateObjectInput();
        input.IgnoreLastServiceId = true;

        const paras = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.FullUpdateParameters();
        paras.AttributesToAddOrUpdate = new this.framework.LBOS.CMFMap();
        paras.AttributesToAddOrUpdate.set(attributeKey, attributeValue);
        input.FullUpdateParameters = paras;

        input.Object = object;

        await this.framework.system.call(input);
        this.framework.logger.warning(`============ change ${object.Name}  Attribute ${attributeKey}: ${attributeValue} `);
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

        const trackoutput = await this.framework.system.call(input);
        this.framework.logger.warning(`------ array: ${materialName}, trackoutOutput: ${trackoutput.Message}`);
    }

    /**
       * Get array material from mes by unit id
       * @param id the id of unit material
       */
    public async getArrayMaterialByUnitId(id: string): Promise<any> {
        try {
            let unitMaterial = await this.getObjectByName(id, "Material", 2);
            if (unitMaterial) {
                if (unitMaterial.ParentMaterial) {
                    this.framework.logger.warning(`------ unit loaded: ${unitMaterial.Name}, array: ${JSON.stringify(unitMaterial.ParentMaterial.Name)}`);
                    return unitMaterial.ParentMaterial;
                } else {
                    // this.framework.logger.error(`Unit: ${id}'s parent Array doesn't exist!`);
                    return undefined;
                }
            }
            else {
                this.framework.logger.error(`Unit: ${id} doesn't exist!`);
                return undefined;
            }
        } catch (e) {
            // throw e;
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

    public async executeQuery(queryName: string, filterValues: any): Promise<any> {
        try {
            let input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.QueryManagement.InputObjects.ExecuteQueryInput();
            input.QueryObject = await this.getObjectByName(queryName, "Cmf.Foundation.BusinessObjects.QueryObject.QueryObject");

            let tFilters = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FilterCollection();
            for (let i = 0; i < filterValues.length; i++) {
                // If filter's value is undefined, dont add it to query
                if (filterValues[i] != undefined) {
                    input.QueryObject.Query.Filters[i].Value = filterValues[i];
                    tFilters.push(input.QueryObject.Query.Filters[i]);
                }
            }
            input.QueryObject.Query.Filters = tFilters;

            let output = await this.framework.system.call(input);
            if (output.NgpDataSet && output.NgpDataSet["T_Result"]) {
                return output.NgpDataSet["T_Result"];
            }
        } catch (ex) {
            this.framework.logger.error(ex.Message);
            return undefined;
        }
    }

    public async manageMaterialDefects(materialName: string, actions: any, state: number): Promise<any> {
        let unitMaterialWithDefect = await this.getObjectByName(materialName, "Material");
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ManageMaterialDefectsInput();
        input.IgnoreLastServiceId = true;
        input.Material = unitMaterialWithDefect;
        input.MaterialDefects = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectCollection();

        // Get defect list filtered by unit name and defect position
        let materialDefectList = await this.executeQuery("CustomGetMaterialDefects", [unitMaterialWithDefect.Name, 0, undefined]);
        if (materialDefectList) {
            for (let item of materialDefectList) {
                this.framework.logger.warning(`------ materialDefectItem: ${JSON.stringify(item)}`);
                // item.Id; Material Defect Id
                // item.Name; Material Defect Name
                // item.ReasonName; Defect Reason Name
                // item.ReferenceDesignator; Defect Position
                let materialDefect = await this.getObjectByName(item.Name, "MaterialDefect");
                materialDefect.SystemState = state;// 0:Open, 1: Fixed, 2: False 3: Accepted, 4: Not Fixable
                materialDefect.CloseRemark = "";
                for (let action of actions) {
                    materialDefect.CloseRemark = materialDefect.CloseRemark + action;
                }
                input.MaterialDefects.push(materialDefect);
            }
        }
        // let materialFalseList = await this.executeQuery("CustomGetMaterialDefects", [unitMaterialWithDefect.Name, 2, undefined]);
        // if (materialFalseList) {
        //     for (let item of materialFalseList) {
        //         this.framework.logger.warning(`------ materialDefectItem: ${JSON.stringify(item)}`);
        //         // item.Id; Material Defect Id
        //         // item.Name; Material Defect Name
        //         // item.ReasonName; Defect Reason Name
        //         // item.ReferenceDesignator; Defect Position
        //         let materialDefect = await this.getObjectByName(item.Name, "MaterialDefect");
        //         materialDefect.SystemState = state;// 0:Open, 1: Fixed, 2: False 3: Accepted, 4: Not Fixable
        //         materialDefect.CloseRemark = "";
        //         for (let action of actions) {
        //             materialDefect.CloseRemark = materialDefect.CloseRemark + action;
        //         }
        //         input.MaterialDefects.push(materialDefect);
        //     }
        // }
        let output = await this.framework.system.call(input);
    }

    public async acceptMaterialDefects(materialName: string, actions: any) {
        this.framework.logger.warning(`------ 01 array: ${materialName}`);
        // Get units by array
        const getsubMaterialIn = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects
            .GetMaterialChildrenWithContainersAsDataSetInput();
        getsubMaterialIn.Material = await this.getObjectByName(materialName, "Material");
        let getsubMaterialOut = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.OutputObjects
            .GetMaterialChildrenWithContainersAsDataSetOutput();
        getsubMaterialOut = await this.framework.system.call(getsubMaterialIn);

        // Handle each action in FDF

        // Select unit related to action by id
        for (const result of getsubMaterialOut.SubMaterialsWithContainers.T_Result) {
            this.framework.logger.warning(`------ 04 unit: ${result.Name}`);
            let unitMaterialWithDefect = await this.getObjectByName(result.Name, "Material");
            let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ManageMaterialDefectsInput();
            input.IgnoreLastServiceId = true;
            input.Material = unitMaterialWithDefect;
            input.MaterialDefects = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectCollection();

            // Get defect list filtered by unit name and defect position
            let materialDefectList = await this.executeQuery("CustomGetMaterialDefects", [unitMaterialWithDefect.Name, 0, undefined]);
            if (materialDefectList) {
                for (let item of materialDefectList) {
                    this.framework.logger.warning(`------ 06 materialDefectItem: ${JSON.stringify(item)}`);
                    // item.Id; Material Defect Id
                    // item.Name; Material Defect Name
                    // item.ReasonName; Defect Reason Name
                    // item.ReferenceDesignator; Defect Position
                    let materialDefect = await this.getObjectByName(item.Name, "MaterialDefect");
                    materialDefect.SystemState = 3;// 0:Open, 1: Fixed, 2: False 3: Accepted, 4: Not Fixable
                    materialDefect.CloseRemark = "";
                    for (let action of actions) {
                        materialDefect.CloseRemark = materialDefect.CloseRemark + action + ";";
                    }
                    input.MaterialDefects.push(materialDefect);
                }
                let output = await this.framework.system.call(input);
                this.framework.logger.warning(`------ array: ${materialName},  acceptMaterialDefects: ${output.Message}`);
            }
        }
    }

    public async getTrackInResource(materialName: string): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForMultipleTrackInWizardInput();
        input.IgnoreLastServiceId = true;
        input.MaterialLevelsToLoad = 2;
        input.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
        let material = await this.getObjectByName(materialName, "Material");
        input.Materials.push(material);
        input.Operation = 0;
        input.ResourceLevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        return output.Resources[0];
    }

    public async changeFlowStep(material: any, flowPath: string, step: string): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ChangeMaterialFlowAndStepInput();
        input.Flow = material.Flow;
        input.FlowPath = flowPath;
        input.IgnoreLastServiceId = true;
        input.Material = material;
        input.Step = await this.getObjectByName(step, "Step");
        let output = await this.framework.system.call(input);
        this.framework.logger.warning(`========changeFlowStep Output: ${output.Message}`);
    }

    public async dispatchAndTrackIn(material: any, resource: any): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexDispatchAndTrackInMaterialsInput();
        input.MaterialCollection = new this.framework.LBOS.CMFMap();
        let dispatchMaterialParameters = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.DispatchMaterialParameters();
        dispatchMaterialParameters.Resource = resource;
        input.MaterialCollection.set(material, dispatchMaterialParameters);
        input.IgnoreLastServiceId = true;
        let output = await this.framework.system.call(input);
        this.framework.logger.warning(`========dispatchAndTrackIn Output: ${output.Message}`);
    }

    public async customAssembleVipperToHeatSink(containerId: string, materialNames: any): Promise<any> {
        let serviceInput: any = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.BaseInput();
        serviceInput["$type"] = "Cmf.Custom.BorgWarnerSuzhou.Orchestration.InputObjects.CustomAssembleVipperToHeatSinkInput, Cmf.Custom.BorgWarnerSuzhou.Orchestration";
        serviceInput.IgnoreLastServiceId = true;
        serviceInput.NumberOfRetries = 10;
        serviceInput.ServiceComments = "CustomAssembleVipperToHeatSink calls api: BorgWarnerSuzhou/CustomAssembleVipperToHeatSink";
        serviceInput["constructor"] = {
            "_CMFInternal_HTTPMethod": "POST",
            "_CMFInternal_URLSuffix": "api/BorgWarnerSuzhou/CustomAssembleVipperToHeatSink"
        };
        serviceInput["ContainerName"] = containerId;
        serviceInput["MaterialNames"] = materialNames;

        this.framework.logger.warning(`${JSON.stringify(serviceInput)}`);

        const result = await this.framework.system.call(serviceInput);
        return result.IsSucceed;
    }

    public async trackOutAndMovenext(materialName: string): Promise<any> {
        let getFlowInput = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForMultipleTrackOutAndMoveNextWizardInput();
        let material = await this.getObjectByName(materialName, "Material");
        getFlowInput.BinningTreeLevelsToLoad = 1;
        getFlowInput.ChecklistLevelsToLoad = 1;
        getFlowInput.DataCollectionInstanceLevelsToLoad = 1;
        getFlowInput.IsToLoadLossMultimedia = false;
        getFlowInput.MaterialLevelsToLoad = 1;
        getFlowInput.Operation = 1;
        getFlowInput.ResourceLevelsToLoad = 1;
        getFlowInput.TopMostMaterialLevelsToLoad = 1;
        getFlowInput.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
        getFlowInput.Materials.push(material);
        let getFlowOutput = await this.framework.system.call(getFlowInput);
        let flowPath = getFlowOutput.NextStepsResults.FlowPath;

        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexTrackOutAndMoveMaterialsToNextStepInput();
        input.Materials = new this.framework.LBOS.CMFMap();
        let complexTrackOutAndMoveNextParameters = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.ComplexTrackOutAndMoveNextParameters();
        complexTrackOutAndMoveNextParameters.SkipDCValidation = false;
        complexTrackOutAndMoveNextParameters.FlowPath = flowPath;
        input.Materials.set(material, complexTrackOutAndMoveNextParameters);
        input.IgnoreLastServiceId = true;
        let output = await this.framework.system.call(input);
        this.framework.logger.warning(`========trackOutAndMovenext Output: ${output.Message}`);
    }

    public async moveNexts(materialName: string, optional: boolean) {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexMoveMaterialsToNextStepInput();
        input.IgnoreLastServiceId = true;
        input.Materials = new this.framework.LBOS.CMFMap();
        let nextLineFlowPath = "";
        let material = await this.getObjectByName(materialName, "Material");
        let nextStepsResults = await this.getDataForMultipleMoveNextWizardInput(material);
        if (optional) {
            for (let item of nextStepsResults) {
                if (item.IsOptional == true) {
                    nextLineFlowPath = item.FlowPath;
                    this.framework.logger.debug(`go to optional step ${item.FlowPath}`);
                    break;
                }
            }
        }
        else {
            for (let item of nextStepsResults) {
                if (item.IsOptional == false) {
                    nextLineFlowPath = item.FlowPath;
                    break;
                }
            }
        }
        input.Materials.set(material, nextLineFlowPath);
        let output = await this.framework.system.call(input);
        this.framework.logger.warning(`------ array: ${materialName}, moveNexts Output: ${output.Message}`);
    }

    public async moveThisStep(materialName: string) {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexMoveMaterialToStepInput();
        input.IgnoreLastServiceId = true;
        input.Material = await this.getObjectByName(materialName, "Material");
        input.FlowPath = input.Material.FlowPath;
        let output = await this.framework.system.call(input);
        this.framework.logger.warning(`------ ${materialName}, moveNexts Output: ${output.Message}`);
    }

    public async getDataForMultipleMoveNextWizardInput(material: any): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForMultipleMoveNextWizardInput();
        input.DataCollectionLevelsToLoad = 1;
        input.MaterialLevelsToLoad = 1;
        input.IsSpecialMoveNext = false;
        input.IgnoreLastServiceId = true;
        input.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
        input.Materials.push(material);
        input.TopMostMaterialLevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        // this.framework.logger.warning(`======= NextStepsResults: ${output.NextStepsResults[0].FlowPath}`);
        return output.NextStepsResults;
    }

    public async getSubMaterials(material: any): Promise<any> {
        // Get units by array
        const getsubMaterialIn = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects
            .GetMaterialChildrenWithContainersAsDataSetInput();
        getsubMaterialIn.Material = material;
        let getsubMaterialOut = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.OutputObjects
            .GetMaterialChildrenWithContainersAsDataSetOutput();
        getsubMaterialOut = await this.framework.system.call(getsubMaterialIn);
        return getsubMaterialOut.SubMaterialsWithContainers.T_Result;
    }

    public async moveLastStep(material: any): Promise<any> {
        let array = material.FlowPath.split(":");
        let flowStep = array[array.length - 1];
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.FacilityManagement.FlowManagement.InputObjects.LoadFlowChildsInput();
        input.Flow = material.Flow;
        input.LevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        let lastStepName = output.Flow.FlowSteps[flowStep - 2].TargetEntity.Name;
        let lastFlowPath = `${material.FlowPath.split("/")[0]}/${lastStepName}:${flowStep - 1}`;
        await this.changeFlowStep(material, lastFlowPath, lastStepName);
    }

    public async getLastFlowPath(material: any): Promise<string> {
        let array = material.FlowPath.split(":");
        let flowStep = array[array.length - 1];
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.FacilityManagement.FlowManagement.InputObjects.LoadFlowChildsInput();
        input.Flow = material.Flow;
        input.LevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        let lastStepName = output.Flow.FlowSteps[flowStep - 2].TargetEntity.Name;
        let lastFlowPath = `${material.FlowPath.split("/")[0]}/${lastStepName}:${flowStep - 1}`;
        return lastFlowPath;
    }

    public async getNextStep(material: any): Promise<string> {
        let array = material.FlowPath.split(":");
        let flowStep = array[array.length - 1];
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.FacilityManagement.FlowManagement.InputObjects.LoadFlowChildsInput();
        input.Flow = material.Flow;
        input.LevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        let nextStepName = output.Flow.FlowSteps[flowStep].TargetEntity.Name;
        return nextStepName;
    }

    /**
     * Rework
     * @param materialName material name of array
     */
    public async rework(material: any, reworkReasonName: string) {
        // let material = await this.getObjectByName(materialName, "Material", 2);
        let reworkPath = await this.getDataForReworkWizard(material, reworkReasonName);

        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexReworkMaterialInput();
        input.IgnoreLastServiceId = true;
        input.Material = material;
        input.MaterialOffFlow = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialOffFlow();
        input.MaterialOffFlow.Material = material;
        input.MaterialOffFlow.OffFlowType = 0;
        input.MaterialOffFlow.Reason = reworkPath.ReworkReason;
        input.MaterialOffFlow.ReturnFlow = material.Flow;//TBD
        input.MaterialOffFlow.ReturnFlowPath = reworkPath.ReturnFlowPath;
        input.MaterialOffFlow.ReturnStep = reworkPath.ReturnStep;
        input.MaterialOffFlow.ReworkPath = reworkPath;
        let output = await this.framework.system.call(input);

        this.framework.logger.warning(`------ array: ${material.Name}, rework Output: ${output.Message}`);
    }

    public async getDataForReworkWizard(material: any, reworkReasonName: string) {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForReworkWizardInput();
        input.DataCollectionLevelsToLoad = 1;
        input.IgnoreLastServiceId = true;
        input.Material = material;
        input.MaterialLevelsToLoad = 1;
        input.TopMostMaterialLevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        for (let item of output.ReworkPathCollection) {
            if (item.ReworkReason.Name == reworkReasonName) {
                return item;
            }
        }
    }

    public async getObjectById(id: string, type: string, levelsToLoad?: number): Promise<any> {
        levelsToLoad = levelsToLoad || 1;

        try {
            const input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.GenericServiceManagement.InputObjects.GetObjectByIdInput();

            input.Id = id;
            input.LevelsToLoad = levelsToLoad;
            input.Type = type;

            const res = await this.framework.system.call(input);

            // framework.logger.info(`Resolved Object Id='${res.Instance.Id}' from Name='${name}'`);
            return (res.Instance);
        } catch (e) {
            return undefined;
        }
    }

    private async storageData(materialName: string, resourceName: string, data: any, status: string): Promise<any> {
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

        const result = await this.framework.system.call(serviceInput);
        return result;
    }

    public async replyBACK(id: string, res: boolean, msg?: string) {
        msg = msg || "N/A";
        if (res) {
            this.outputs.replyContent.emit(`BACK|id=${id}|status=PASS\n`);
            this.framework.logger.info(`====== replyBACK: BACK|id=${id}|status=PASS`);
        }
        else {
            if (msg != "N/A") {
                this.outputs.replyContent.emit(`BACK|id=${id}|status=FAIL|msg=${msg}\n`);
                this.framework.logger.info(`====== replyBACK: BACK|id=${id}|status=FAIL|msg=${msg}`);
            } else {
                this.outputs.replyContent.emit(`BACK|id=${id}|status=FAIL\n`);
                this.framework.logger.info(`====== replyBACK: BACK|id=${id}|status=FAIL`);
            }
        }
    }
}
