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
        let resource = inputs.resource;
        this.outputs = outputs;

        if (msg.name == "BREQ") {
            this.HandleBREQ(msg, resource);
        }

        if (msg.name == "BCMP") {
            this.HandleBCMP(msg, resource);
        }
    }

    /**
     * BREQ message process
     * @param msg an object contains parsed parameters from BREQ message
     */
    public async HandleBREQ(msg: any, resource: any) {
        let id = "";
        let process = "";
        let station = "";
        let side = "";
        let resName = resource.Name

        try {
            for (let item of msg.variables) {
                if (item.name == "id") {
                    id = item.value;
                    if (!id || id.length == 0) {
                        await this.replyBCNF(id, false, `Missing "id" parameter in FDF message!`);
                        return;
                    }
                }
                if (item.name == "process") {
                    process = item.value;
                    if (!process || process.length == 0) {
                        await this.replyBCNF(id, false, `Missing "process" parameter in FDF message!`);
                        return;
                    }
                }
                if (item.name == "station") {
                    station = item.value;
                    if (!station || station.length == 0) {
                        await this.replyBCNF(id, false, `Missing "station" parameter in FDF message!`);
                        return;
                    }
                }
                if (item.name == "software") {
                    let software: string = item.value.toLowerCase();
                    if (!software || software.length == 0) {
                        await this.replyBCNF(id, false, `Missing "software" parameter in FDF message!`);
                        return;
                    }
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
                }
            }

            // Board Check
            let board = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.Material();
            board = await this.getObjectByName(id, "Material", 3);
            if (board) {
                if (board.ParentMaterial) {
                    if (!board.ParentMaterial.ParentMaterial) {
                        // await this.replyBCNF(id, true, "", board.ParentMaterial.SubMaterialCount);
                        // expand array and boards by Laser's info.
                        this.framework.logger.warning(`Insert array to line started!`);
                        let insertResult = await this.customExpandArrayAndBoradInSPIByIoTDEE(id, resName);
                        this.framework.logger.warning(`Insert array to line ended! result: ${insertResult}`);
                        // return FAIL if array build failed.
                        if (!insertResult) {
                            await this.replyBCNF(id, false, `${id} didn't insert to line successfully!`);
                            return;
                        } else {
                            board = await this.getObjectByName(id, "Material", 3);
                            if (!board.ParentMaterial.ParentMaterial) {
                                await this.replyBCNF(id, false, `Expanded, but ${id} still doesn't belong to any line in MES!`);
                                return;
                            }
                        }
                    }
                } else {
                    await this.replyBCNF(id, false, `${id}'s Array is not found in MES`);
                    return;
                }
            } else {
                await this.replyBCNF(id, false, `${id} is not found in MES`);
                return;
            }

            // Side Check 
            const lineName = board.ParentMaterial.ParentMaterial.Step.Name.toLowerCase();
            if (!lineName.includes(side)) {
                await this.replyBCNF(id, false, `${id} is in Line "${lineName}", but side is "${side}"`);
                return;
            }

            // If panel is in inprocess state, track out it first!
            if (board.SystemState == 2) {
                this.framework.logger.warning(`====== ${id} is in ${board.Step.Name} in MES, so we should trackOut first!`);
                await this.trackOut(board.ParentMaterial);
                board = await this.getObjectByName(id, "Material", 3);
            }

            // Station Check
            if (station != msg.entity) {
                await this.replyBCNF(id, false, `Incorrect Station! MES resource instance name: ${msg.entity}, FDF station: ${station}`);
                return;
            }

            // Route Check
            // If panel is not in SPI step, change panel's step to target step!
            side = (side.length == 0) ? "TOP" : side.toUpperCase();
            let lastResourceName = await this.getMaterialLastResourceByCustomEntity(board.Name);
            this.framework.logger.warning(`======= lastResourceName: ${lastResourceName}, board.Step.Name: ${board.Step.Name}`)
            if (lastResourceName) {
                if (lastResourceName.includes("SPIR")) {
                    if (board.Step.Name.includes("SPI_REVIEW") || board.Step.Name.includes("CHIPPLACEMENT_1")) {
                        await this.moveLastStep(board.ParentMaterial, 2);
                        board = await this.getObjectByName(id, "Material", 3);
                    }
                }
                else if (lastResourceName.includes("SPI")) {
                    if (board.Step.Name.includes("SPI")) {
                        await this.moveLastStep(board.ParentMaterial, 1);
                        board = await this.getObjectByName(id, "Material", 3);
                    }
                }
            }

            // If material is in Solder paste Step, it should trackin and out from SPP first.
            if (!board.Step.Name.includes(process)) {
                if (board.Step.Name.includes(`SOLDER_PASTE_PRINT_${side}`)) {
                    if (board.SystemState == 0) {
                        board.ParentMaterial = await this.trackInWithoutResourceInfo(board.ParentMaterial);
                        board.ParentMaterial = await this.trackOut(board.ParentMaterial);
                    }
                    else if (board.SystemState == 2) {
                        board.ParentMaterial = await this.trackOut(board.ParentMaterial);
                    }
                } else {
                    await this.replyBCNF(id, false, `${id} is in ${board.Step.Name} in MES, not in process ${process} or its System State is not Queued.`);
                    return;
                }
            }

            // Normal trace for array in current Step
            await this.trackInWithoutResourceInfo(board.ParentMaterial);
            await this.replyBCNF(id, true, "", board.ParentMaterial.SubMaterialCount);
        } catch (e) {
            await this.replyBCNF(id, false, e.message);
        }
    }

    /**
     * BCMP message process
     * @param msg an object contains parsed parameters from BCMP message
     */
    public async HandleBCMP(msg: any, resource: any) {
        let id = "";
        let process = "";
        // let map = "";
        let defects = [];
        let actions = [];
        let station = "";
        let status = "";
        let side = "";
        let recordData = [];

        try {
            let resourceName = await this.framework.dataStore.retrieve('entityResourceName', 'N/A');
            let defectRecordCountLimit = Number(await this.loadObjectAttribute(resource, "CustomDefectRecordCountLimit"));
            this.framework.logger.warning(`------ ${resource.Name} -- CustomDefectRecordCountLimit: '${defectRecordCountLimit}'`)

            let board = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.Material();
            for (let item of msg.variables) {
                if (item.name == "id") {
                    id = item.value;
                    board = await this.getObjectByName(id, "Material", 3);
                    if (!board) {
                        await this.replyBACK(id, false, `${id} is not found in MES`);
                        return;
                    }
                    if (!board.ParentMaterial) {
                        await this.replyBACK(id, false, `${id}'s Array doesn't exits in MES`);
                        return;
                    }
                }
                if (item.name == "process") {
                    process = item.value;
                    if (!board.Step.Name.includes(process) || board.SystemState != 2) {
                        await this.replyBACK(id, false, `${id} is in ${board.Step.Name} in MES, not in process ${process} or its System State is not Queued.`);
                        return;
                    }
                }
                if (item.name == "station") {
                    station = item.value;
                    // const resource = board.LastProcessedResource;
                    // const mesStation = await this.loadObjectAttribute(resource, "CustomFormerModelName");
                    if (station != msg.entity) {
                        await this.replyBACK(id, false, `Incorrect Station! MES resource instance name: ${msg.entity}, FDF station: ${station}`);
                        return;
                    }
                }
                if (item.name == "software") {
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
                    const lineName = board.ParentMaterial.ParentMaterial.Step.Name.toLowerCase();
                    if (!lineName.includes(side)) {
                        await this.replyBACK(id, false, `${id} is in Line ${lineName}, but FDF software is ${software}`);
                        return;
                    }
                }
                else if (item.name == "status") {
                    status = item.value.toUpperCase();
                    recordData.push(["status", item.value]);
                    this.outputs.arrayMaterial.emit(board.ParentMaterial);
                    if (status == "PASS") {
                        await this.acceptMaterialDefects(board.ParentMaterial.Name, []);
                        this.outputs.passFail.emit("Pass");
                    } else {
                        this.outputs.passFail.emit("Fail");
                    }
                }
                // else if (item.name == "map") {
                //     map = item.value;
                // }
                else if (item.name == "visiondefect") {
                    if (!defectRecordCountLimit || defects.length < defectRecordCountLimit) {
                        recordData.push(["visiondefect", item.value]);
                        defects.push(item.value);
                        this.framework.logger.warning(`======DEFECT: ${item.value}`);
                    }
                }
                else if (item.name == "visionaction") {
                    recordData.push(["visionaction", item.value]);
                    actions.push(item.value);
                }
            }

            let unitMaterails = await this.getUnitsByArray(board.ParentMaterial);
            // for (let unit of unitMaterails) {
            //     let result = await this.storageData(unit.Name, resourceName, recordData, status);
            //     if (result) {
            //         this.framework.logger.warning(`-----All datas of ${unit.Name} are storaged successfully.`);
            //     } else {
            //         await this.replyBACK(id, false, `Some datas are storaged failed`)
            //         return;
            //     }
            // }
            let materialNames = [];
            for (let unit of unitMaterails) {
                materialNames.push(unit.Name);
            }
            let result = await this.storageDatas(materialNames, resourceName, recordData, status);
            if (result) {
                this.framework.logger.warning(`-----All datas of ${board.ParentMaterial.Name}'s units are storaged successfully.`);
            } else {
                await this.replyBACK(id, false, `Some datas are storaged failed`)
                return;
            }

            this.framework.logger.warning(`======DEFECT.LENGTH: ${defects.length}, STATUS: ${status}`);
            if (defects.length > 0 && status == "FAIL") {
                //record defects
                this.framework.logger.warning(`${defects.length} defect(s) will be recorded`)
                await this.recordDefects(unitMaterails, defects);//TODO:20231212
                // trackout from SPI step -> trackin to review step
                await this.trackOutWithNextLineFlowPath(board.ParentMaterial.Name, true);
            }
            else {
                this.framework.logger.warning("=== NO Defect ===");
                await this.trackOutWithNextLineFlowPath(board.ParentMaterial.Name, false);
                // await this.trackInWithoutResourceInfo(panelMaterial.Name);
                // await this.trackOut(panelMaterial.Name);
            }
            await this.replyBACK(id, true);
        } catch (e) {
            await this.replyBACK(id, false, e.message);
        }
    }

    public async getMaterialLastResourceByCustomEntity(mateiralName: string): Promise<any> {
        const input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.QueryManagement.InputObjects.ExecuteQueryInput();

        const filterCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FilterCollection();

        // Filter filter_0
        const filter_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter_0.Name = "Name";
        filter_0.ObjectName = "Material";
        filter_0.ObjectAlias = "CustomUnitDataInfo_Material_2";
        filter_0.Operator = this.framework.LBOS.Cmf.Foundation.Common.FieldOperator.Contains;
        filter_0.Value = mateiralName;
        filter_0.LogicalOperator = this.framework.LBOS.Cmf.Foundation.Common.LogicalOperator.Nothing;
        filter_0.FilterType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.FilterType.Normal;

        filterCollection.push(filter_0);

        const fieldCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FieldCollection();

        // Field field_0
        const field_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_0.Alias = "Name";
        field_0.ObjectName = "CustomUnitDataInfo";
        field_0.ObjectAlias = "CustomUnitDataInfo_1";
        field_0.IsUserAttribute = false;
        field_0.Name = "Name";
        field_0.Position = 0;
        field_0.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.Descending;

        // Field field_1
        const field_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_1.Alias = "ResourceName";
        field_1.ObjectName = "Resource";
        field_1.ObjectAlias = "CustomUnitDataInfo_Resource_2";
        field_1.IsUserAttribute = false;
        field_1.Name = "Name";
        field_1.Position = 1;
        field_1.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        fieldCollection.push(field_0);
        fieldCollection.push(field_1);


        const relationCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.RelationCollection();

        // Relation relation_0
        const relation_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Relation();
        relation_0.Alias = "";
        relation_0.IsRelation = false;
        relation_0.Name = "";
        relation_0.SourceEntity = "CustomUnitDataInfo";
        relation_0.SourceEntityAlias = "CustomUnitDataInfo_1",
            relation_0.SourceJoinType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.JoinType.InnerJoin;
        relation_0.SourceProperty = "MaterialId";
        relation_0.TargetEntity = "Material";
        relation_0.TargetEntityAlias = "CustomUnitDataInfo_Material_2";
        relation_0.TargetJoinType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.JoinType.InnerJoin;
        relation_0.TargetProperty = "Id";

        // Relation relation_1
        const relation_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Relation();
        relation_1.Alias = "";
        relation_1.IsRelation = false;
        relation_1.Name = "";
        relation_1.SourceEntity = "CustomUnitDataInfo";
        relation_1.SourceEntityAlias = "CustomUnitDataInfo_1",
            relation_1.SourceJoinType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.JoinType.InnerJoin;
        relation_1.SourceProperty = "ResourceId";
        relation_1.TargetEntity = "Resource";
        relation_1.TargetEntityAlias = "CustomUnitDataInfo_Resource_2";
        relation_1.TargetJoinType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.JoinType.InnerJoin;
        relation_1.TargetProperty = "Id";

        relationCollection.push(relation_0);
        relationCollection.push(relation_1);

        const query = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.QueryObject();
        query.Description = "";
        query.EntityTypeName = "CustomUnitDataInfo";
        query.Name = "CustomUnitDataInfoDetail";
        query.Query = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Query();
        query.Query.Distinct = false;
        query.Query.Filters = filterCollection;
        query.Query.Fields = fieldCollection;
        query.Query.Relations = relationCollection;

        input.QueryObject = query;
        const output = await this.framework.system.call(input);
        if (output.NgpDataSet && output.NgpDataSet["T_Result"]) {
            return output.NgpDataSet["T_Result"][0].ResourceName;
        }
        this.framework.logger.warning(`====== getMaterialLastResourceByCustomEntity execute Query finished`);
    }

    // TrackIn without Resource Info
    public async trackInWithoutResourceInfo(material: any): Promise<any> {
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.GetDataForMultipleTrackInWizardInput();
        input.IgnoreLastServiceId = true;
        input.MaterialLevelsToLoad = 2;
        input.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
        // let material = await this.getObjectByName(materialName, "Material");
        input.Materials.push(material);
        input.Operation = 0;
        input.ResourceLevelsToLoad = 1;
        // this.framework.logger.warning(JSON.stringify(input));
        let output = await this.framework.system.call(input);

        this.framework.logger.warning(`====== trackin resource length: ${output.Resources.length}`);
        if (output.Resources && output.Resources.length > 0) {
            let resource = output.Resources[0];

            let trackininput = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexTrackInMaterialsInput();
            trackininput.IgnoreLastServiceId = true;
            trackininput.Materials = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialCollection();
            this.framework.logger.warning(`====== trackin material name: ${material.Name}`);
            trackininput.Materials.push(material);
            trackininput.Resource = resource;
            let trackinoutput = await this.framework.system.call(trackininput);
            if (!trackinoutput.Materials || trackininput.Materials.length == 0) {
                throw new Error(`There isn't any material performed trackin!`);
            }
            this.framework.logger.warning(`====== array: ${material.Name}, trackinoutput: ${trackinoutput.Message}`);
            return trackinoutput.Materials[0];
        }
        throw new Error(`There isn't any resource can be used for tracking!`);
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

    public async getUnitsByArray(arrayMaterial: any): Promise<any> {
        // Get units by array
        const getsubMaterialIn = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects
            .GetMaterialChildrenWithContainersAsDataSetInput();
        getsubMaterialIn.Material = arrayMaterial;
        getsubMaterialIn.IgnoreLastServiceId = true;
        let getsubMaterialOut = await this.framework.system.call(getsubMaterialIn);
        return getsubMaterialOut.SubMaterialsWithContainers.T_Result;
    }

    /**
     * Record defects
     * @param materialName material name of array
     * @param defects defect list
     */
    public async recordDefects(materials: any, defects: any): Promise<any> {
        this.framework.logger.warning(`------ 00 defects.length: ${defects.length}`);

        for (const result of materials) {
            this.framework.logger.warning(`------ 01 unit: ${result.Name}`);

            let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.RecordMaterialDefectsInput();
            input.Material = await this.getObjectByName(result.Name, "Material");
            input.MaterialDefects = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefectCollection();

            for (let item of defects) {
                let materialdefect = new this.framework.LBOS.Cmf.Navigo.BusinessObjects.MaterialDefect();
                materialdefect.DefectSource = 2;
                materialdefect.DefectType = 0;
                materialdefect.OpenRemark = item;
                materialdefect.Reason = await this.getObjectByName("VisionDefect", "Reason");

                input.MaterialDefects.push(materialdefect);
            }
            if (input.MaterialDefects.length > 0) {
                let output = await this.framework.system.call(input);
                this.framework.logger.warning(`------ unit: ${result.Name}, recordDefects: ${output.Message}, MaterialDefects' count: ${input.MaterialDefects.length}`);
            }
        }
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
    public async trackOut(material: any): Promise<any> {
        const input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects.ComplexTrackOutMaterialsInput();
        input.IgnoreLastServiceId = true;

        input.Material = new this.framework.LBOS.CMFMap();
        // const material = await this.getObjectByName(materialName, "Material");
        input.Material.set(material, new this.framework.LBOS.Cmf.Navigo.BusinessObjects.ComplexTrackOutParameters);

        const trackoutput = await this.framework.system.call(input);
        this.framework.logger.warning(`------ array: ${material.Name}, trackoutOutput: ${trackoutput.Message}`);
        for (let key of trackoutput.Materials.keys()) {
            return key;
        }
        throw new Error(`There isn't any material be performed trackin!`);
    }

    /**
     * Get array material from mes by unit id
     * @param id the id of unit material
     */
    public async getArrayMaterialByUnitId(id: string): Promise<any> {
        // this.framework.logger.warning(`UnitId: ${id}`)
        let unitMaterial = await this.getObjectByName(id, "Material", 2);
        if (unitMaterial) {
            this.framework.logger.warning(`------ unit loaded: ${unitMaterial.Name}, array: ${JSON.stringify(unitMaterial.ParentMaterial.Name)}`);
            if (unitMaterial.ParentMaterial) {
                return unitMaterial.ParentMaterial;
            } else {
                this.framework.logger.error(`Unit: ${id}'s parent Array doesn't exist!`);
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

    public async acceptMaterialDefects(materialName: string, actions: any) {
        this.framework.logger.error(`actions:${JSON.stringify(actions)}`)
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
            let query = await this.getMaterialDefectsQuery(result.Name);
            let materialDefectList = await this.executeQuery(query);
            if (materialDefectList) {
                for (let item of materialDefectList) {
                    this.framework.logger.warning(`------ 06 materialDefectItem: ${JSON.stringify(item)}`);
                    // item.Id; Material Defect Id
                    // item.Name; Material Defect Name
                    // item.ReasonName; Defect Reason Name
                    // item.ReferenceDesignator; Defect Position
                    let materialDefect = await this.getObjectByName(item.Name, "MaterialDefect");
                    materialDefect.SystemState = 2;// 0:Open, 1: Fixed, 2: False 3: Accepted, 4: Not Fixable
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

    public async replyBACK(id: string, res: boolean, msg?: string | "") {
        let msg1 = "";
        if (msg && msg.length > 0) msg1 = `|msg=${msg}`;
        if (res) {
            this.outputs.replyContent.emit(`BACK|id=${id}|status=PASS${msg1}\n`);
            this.framework.logger.info(`====== replyBACK: BACK|id=${id}|status=PASS${msg1}`);
        }
        else {
            this.outputs.replyContent.emit(`BACK|id=${id}|status=FAIL${msg1}\n`);
            this.framework.logger.error(`====== replyBACK: BACK|id=${id}|status=FAIL${msg1}`);
        }
    }

    public async replyBCNF(id: string, res: boolean, msg?: string | "", unitCounts?: number | 0) {
        let msg1 = "";
        if (msg && msg.length > 0) msg1 = `|msg=${msg}`;
        if (res) {
            // let panelMaterial = await this.getArrayMaterialByUnitId(id);
            // // Get units by array
            // const getsubMaterialIn = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.InputObjects
            //     .GetMaterialChildrenWithContainersAsDataSetInput();
            // getsubMaterialIn.Material = await this.getObjectByName(panelMaterial.Name, "Material");
            // let getsubMaterialOut = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.MaterialManagement.OutputObjects
            //     .GetMaterialChildrenWithContainersAsDataSetOutput();
            // getsubMaterialOut = await this.framework.system.call(getsubMaterialIn);
            // for (const result of getsubMaterialOut.SubMaterialsWithContainers.T_Result) {
            // }

            let map = "";
            for (let i = 0; i < unitCounts; i++) {
                map += "1";
            }

            this.outputs.replyContent.emit(`BCNF|id=${id}|status=PASS|map=${map}${msg1}\n`);
            this.framework.logger.info(`====== replyBCNF: BCNF|id=${id}|status=PASS|map=${map}${msg1}`);
        }
        else {
            this.outputs.replyContent.emit(`BCNF|id=${id}|status=FAIL${msg1}\n`);
            this.framework.logger.error(`====== replyBCNF: BCNF|id=${id}|status=FAIL${msg1}`);
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
    }

    public async moveLastStep(material: any, stepCount: number): Promise<any> {
        let array = material.FlowPath.split(":");
        let flowStepNum = array[array.length - 1];
        let input = new this.framework.LBOS.Cmf.Navigo.BusinessOrchestration.FacilityManagement.FlowManagement.InputObjects.LoadFlowChildsInput();
        input.Flow = material.Flow;
        input.LevelsToLoad = 1;
        let output = await this.framework.system.call(input);
        let lastStepName = "";

        for (let flowStep of output.Flow.FlowSteps) {
            if (flowStep.CorrelationID == Number(flowStepNum) - stepCount) {
                lastStepName = flowStep.TargetEntity.Name;
                break;
            }
        }

        // let lastStepName = output.Flow.FlowSteps[flowStep - 2].TargetEntity.Name;
        let lastFlowPath = `${material.FlowPath.split("/")[0]}/${lastStepName}:${Number(flowStepNum) - stepCount}`;
        await this.changeFlowStep(material, lastFlowPath, lastStepName);
    }

    public async customExpandArrayAndBoradInSPIByIoTDEE(boardId: string, resourceName: string): Promise<boolean> {
        const load_dee_input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.DynamicExecutionEngineManagement.InputObjects.GetActionByNameInput();
        load_dee_input.Name = "CustomExpandArrayAndBoradInSPIByIoTDEE";
        const load_dee_output = await this.framework.system.call(load_dee_input);
        // Execute DEE
        const input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.DynamicExecutionEngineManagement.InputObjects.ExecuteActionInput();
        input.Action = load_dee_output.Action;
        // input.NumberOfRetries = 5;
        const deeInputs = new Map();
        deeInputs.set("boardId", boardId);
        deeInputs.set("subResourceName", resourceName);
        input.Input = deeInputs;
        this.framework.logger.info(`Calling DEE '${load_dee_input.Name}' with inputs: '${JSON.stringify([...deeInputs.entries()])}'`);
        let outDEE = await this.framework.system.call(input);

        return outDEE;
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

    private async storageDatas(materialNames: any, resourceName: string, data: any, status: string): Promise<any> {
        // Do data collection
        this.outputs.batchPassFail.emit({
            materialNames: materialNames,
            resourceName: resourceName,
            status: status
        })

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

        const result = await this.framework.system.call(serviceInput);
        return result;
    }

    public async customSystemCall(framework: any, input: any, settings?: any): Promise<any> {
        settings = settings || { maxRetries: 10, sleepBetweenRetries: 1000 };
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
}
