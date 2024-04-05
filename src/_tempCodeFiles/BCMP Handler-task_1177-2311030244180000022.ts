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
        let msg = JSON.parse(inputs.JSONToSend);
        this.outputs = outputs;

        if (msg.name == "BCMP") {
            this.HandleBCMP(msg);
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
        let actions = [];
        let station = "";
        let status = "";
        let side = "";
        let isPositiveSequence = true;
        let recordData = [];

        let resourceName = await this.framework.dataStore.retrieve('entityResourceName', 'N/A');
        let resource = await this.getObjectByName(resourceName, "Resource");
        let defectRecordCountLimit = Number(await this.loadObjectAttribute(resource, "CustomDefectRecordCountLimit"));
        let unitMaterial = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.Material();

        for (let item of msg.variables) {
            if (item.name == "id") {
                id = item.value;
                unitMaterial = await this.getUnitMaterial(id);
                if (!unitMaterial) {
                    await this.reply(id, false, `Unit: ${id} does not exist in MES!`);
                    return;
                }
                if (unitMaterial.Step.Name.includes("AOI_REVIEW") && unitMaterial.ParentMaterial.SystemState == 2) {
                    await this.trackOut(unitMaterial.ParentMaterial.Name);
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
                    // this.framework.logger.error(`====== Incorrect Station! MES resource instance name: ${msg.entity}, FDF station: ${station}`);
                    return;
                }
            }
            else if (item.name == "software") {
                recordData.push(["software", item.value]);
                let software: string = item.value.toLowerCase();
                // if (/[\-_](top)$/.exec(software)) side = "top";
                // else if (/[\-_](bot)$/.exec(software)) side = "bot";
                // else if (/[\-_](s1)$/.exec(software)) side = "s1";
                // else if (/[\-_](s2)$/.exec(software)) side = "s2";
                // else if (/[\-_](rss1)$/.exec(software)) side = "rss1";
                // else if (/[\-_](rss2)$/.exec(software)) side = "rss2";

                // else if (/[\-_](top)[\-_]/.exec(software)) side = "top";
                // else if (/[\-_](bot)[\-_]/.exec(software)) side = "bot";
                // else if (/[\-_](s1)[\-_]/.exec(software)) side = "s1";
                // else if (/[\-_](s2)[\-_]/.exec(software)) side = "s2";
                // else if (/[\-_](rss1)[\-_]/.exec(software)) side = "rss1";
                // else if (/[\-_](rss2)[\-_]/.exec(software)) side = "rss2";
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
                recordData.push(["status", item.value]);
            }
            else if (item.name == "map") {
                recordData.push(["map", item.value]);
                map = item.value;
                // this.outputs.arrayMaterial.emit(unitMaterial.ParentMaterial);
                if (map.includes("0")) {
                    status = "FAIL";
                    // this.outputs.passFail.emit("Fail");
                } else {
                    status = "PASS";
                    // this.outputs.passFail.emit("Pass");
                }
                // let result = await this.storageData(unitMaterial.Name, resourceName, [], status);
                // if (result) {
                //     this.framework.logger.warning("-----Data and status are storaged successfully.");
                // } else {
                //     this.framework.logger.warning("-----Data and status are storaged failed.");
                // }
            }
            else if (item.name == "defect") {
                if (!defectRecordCountLimit || defects.length < defectRecordCountLimit) {
                    recordData.push(["defect", item.value]);
                    defects.push(item.value);
                }
            }
            else if (item.name == "action") {
                recordData.push(["action", item.value]);
                actions.push(item.value);
            }
        }

        if (side == "") side = "TOP";
        side = side.toUpperCase();
        // let flowPath = `SMT_PROCESS_${side}_4CP:A:1/REFLOW_AOI_${side}:9`;
        let step = `REFLOW_AOI_${side}`;
        if (unitMaterial.Step.Name != step) {
            // if (unitMaterial.LastProcessedResource && unitMaterial.LastProcessedResource.Name.includes("SMT_UNLOAD")) {
            // await this.changeFlowStep(unitMaterial.ParentMaterial, flowPath, step);
            await this.changeNearbyStep(unitMaterial.ParentMaterial, step);
            unitMaterial = await this.getObjectByName(id, "Material", 3);
            // }
        }

        if (!unitMaterial.ParentMaterial.Step.Name.includes(process)) {
            // this.framework.logger.error(`Unit: ${id} are not in correct step!`);
            await this.reply(id, false, `Unit: ${id} are not in correct step!`);
            return;
        }

        let unitIndex = Number(await this.loadObjectAttribute(unitMaterial, "CustomMapIndex"));
        let unitMaterails = await this.getUnitsByArray(unitMaterial.ParentMaterial);
        if (unitIndex == 1) {
            isPositiveSequence = true;
        }
        else if (unitIndex == unitMaterails.length) {
            isPositiveSequence = false;
        }
        else {
            // this.framework.logger.error(`Unit: ${id} is not the fisrt or last board in Array!`);
            await this.reply(id, false, `Unit: ${id} is not the fisrt or last board in Array!`);
        }


        // If panel is in queued state, track in it first!
        if (unitMaterial.SystemState != 2) {//&& board.ParentMaterial.LastProcessedResource.Name
            // this.framework.logger.warning(`====== ${id} is in ${board.Step.Name} in MES, so we should trackOut first!`);
            await this.trackInWithoutResourceInfo(unitMaterial.ParentMaterial.Name);
        }

        let result = await this.storageData(unitMaterial.Name, resourceName, recordData, status);
        if (result) {
            this.framework.logger.warning("-----All datas  are storaged successfully.");
        } else {
            await this.reply(id, false, `Some datas are storaged failed`)
            // this.framework.logger.warning("-----Some datas are storaged failed.");
            return;
        }

        if (defects.length > 0) {
            //record defects
            await this.recordDefects(unitMaterails, defects, isPositiveSequence);
            // trackout from AOI step -> trackin to review step
            await this.trackOutWithNextLineFlowPath(unitMaterial.ParentMaterial.Name, process);
            await this.trackInWithoutResourceInfo(unitMaterial.ParentMaterial.Name);
        }
        else {
            // accept all units' defects
            await this.acceptMaterialDefects(unitMaterails);
            // trackout from AOI step -> track in to unload step -> track out from unload step
            await this.trackOutWithNextLineFlowPath(unitMaterial.ParentMaterial.Name, "UNLOAD");
            await this.trackInWithoutResourceInfo(unitMaterial.ParentMaterial.Name);
            await this.trackOut(unitMaterial.ParentMaterial.Name);
        }
        await this.reply(id, true);
    }

    public async getUnitsByArray(arrayMaterial: any): Promise<any> {
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

            // let trackininwizardinput = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForMultipleTrackInWizardInput();
            // trackininwizardinput.IgnoreLastServiceId = true;
            // trackininwizardinput.MaterialLevelsToLoad = 2;
            // trackininwizardinput.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
            // trackininwizardinput.Materials.push(material);
            // trackininwizardinput.Operation = 0;
            // trackininwizardinput.ResourceLevelsToLoad = 1;
            // let trackinwizardoutput = await this.framework.system.call(trackininwizardinput);
            // let stateModelTransition = trackinwizardoutput.ResourcePossibleTransitions.Transitions[0];
            // trackininput.StateModelTransition = stateModelTransition;

            let trackinoutput = await this.framework.system.call(trackininput);
            this.framework.logger.warning(`====== array: ${materialName}, trackinoutput: ${trackinoutput.Message}`);
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
                trackOutParam.NextLineFlowPath = item.LogicalFlowPath;
            }
        }
        trackOutParam.SkipDCValidation = false;
        input.Material.set(material, trackOutParam);
        let output = await this.framework.system.call(input);
        this.framework.logger.warning(`------ array: ${materialName}, trackOutWithNextLineFlowPath Output: ${output.Message}`);
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

    /**
     * Record defects
     * @param materialName material name of array
     * @param defects defect list
     */
    public async recordDefects(unitMaterails: any, defects: any, isPositiveSequence: boolean): Promise<any> {
        this.framework.logger.warning(`------ 00 defects.length: ${defects.length}`);

        // // Get units by array
        // const getsubMaterialIn = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects
        //     .GetMaterialChildrenWithContainersAsDataSetInput();
        // getsubMaterialIn.Material = await this.getObjectByName(materialName, "Material");
        // let getsubMaterialOut = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.OutputObjects
        //     .GetMaterialChildrenWithContainersAsDataSetOutput();
        // getsubMaterialOut = await this.framework.system.call(getsubMaterialIn);

        // Panel with one unit
        if (unitMaterails.length == 1) {
            let result = unitMaterails[0];
            this.framework.logger.warning(`------ 01 unit: ${result.Name}`);

            let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.RecordMaterialDefectsInput();
            input.Material = await this.getObjectByName(result.Name, "Material");
            input.MaterialDefects = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectCollection();

            for (let item of defects) {
                let defectdetails = item.split(',');

                let materialdefect = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefect();
                materialdefect.DefectSource = 2;
                materialdefect.DefectType = 0;
                materialdefect.OpenRemark = defectdetails[0];
                materialdefect.Reason = await this.getObjectByName(defectdetails[2], "Reason");
                materialdefect.ReferenceDesignator = defectdetails[1];

                input.MaterialDefects.push(materialdefect);
            }

            let output = await this.framework.system.call(input);
            this.framework.logger.warning(`------ unit: ${result.Name}, recordDefects: ${output.Message}, MaterialDefects' count: ${input.MaterialDefects.length}`);
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

                for (let item of defects) {
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
                        materialdefect.OpenRemark = defectdetails[0];
                        materialdefect.Reason = await this.getObjectByName(defectdetails[2], "Reason");
                        materialdefect.ReferenceDesignator = unitDefectPositions[unitDefectPositions.length - 1];

                        input.MaterialDefects.push(materialdefect);
                    }
                }
                if (input.MaterialDefects.length > 0) {
                    let output = await this.framework.system.call(input);
                    this.framework.logger.warning(`------ unit: ${result.Name}, recordDefects: ${output.Message}, MaterialDefects' count: ${input.MaterialDefects.length}`);
                }
            }
        }
    }

    public async acceptMaterialDefects(unitMaterails: any) {
        // Handle each action in FDF

        // Select unit related to action by id
        for (const result of unitMaterails) {
            // this.framework.logger.warning(`------ unit: ${result.Name}`);
            // Get defect list filtered by unit name and defect position
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
                    materialDefect.SystemState = 3;// 0:Open, 1: Fixed, 2: False 3: Accepted, 4: Not Fixable
                    materialDefect.CloseRemark = "AOI online re-test passed without any action";
                    input.MaterialDefects.push(materialDefect);
                }
                let output = await this.framework.system.call(input);
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
        let output = await this.framework.system.call(input);
    }

    public async changeNearbyStep(material: any, stepName: string): Promise<any> {
        let array = material.FlowPath.split(":");
        let flowStepNum = array[array.length - 1];
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.FacilityManagement.FlowManagement.InputObjects.LoadFlowChildsInput();
        input.Flow = material.Flow;
        input.LevelsToLoad = 1;
        let output = await this.framework.system.call(input);
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
}
