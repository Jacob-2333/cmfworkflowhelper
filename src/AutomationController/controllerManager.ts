import { LocalFramework } from "src/localFramework";


export class ControllerManager {
    private framework: LocalFramework;
    public universalStateMap:any={};

    constructor(framework: LocalFramework) {
        this.framework = framework;


        // enum Color {
        //     Red = 'red',
        //     Green = 'green',
        //     Blue = 'blue'
        //   }
        // this.framework.funa();

        // 创建一个映射表
        Object.keys(framework.LBOS.Cmf.Foundation.Common.Base.UniversalState).forEach(key => {
            const value = framework.LBOS.Cmf.Foundation.Common.Base.UniversalState[key as keyof typeof framework.LBOS.Cmf.Foundation.Common.Base.UniversalState];
            // console.log(`key ${key}, type value: ${value}`);
            this.universalStateMap[value] = key;
        });
        console.log(JSON.stringify(this.universalStateMap));
    }

    public async loadAutomationControllerItems(id:string){
        try {
            let input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.ConnectIoTManagement.InputObjects.LoadAutomationControllerItemsInput();
            input.AutomationController = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.AutomationController();
            input.AutomationController.Id=id;
            input.LevelsToLoad=1;
            let output = await this.framework.system.call(input);
            return output;
        } catch (ex: any) {
            console.log(ex.Message);
            // this.framework.logger.error(ex.Message);
            return undefined;
        }
    }

    public async queryControllerList(name: string) {
        const filterCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FilterCollection();

        // Filter filter_0
        const filter_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter_0.Name = "Name";
        filter_0.ObjectName = "AutomationController";
        filter_0.ObjectAlias = "AutomationController_1";
        filter_0.Operator = this.framework.LBOS.Cmf.Foundation.Common.FieldOperator.Contains;
        filter_0.Value = name;
        filter_0.LogicalOperator = this.framework.LBOS.Cmf.Foundation.Common.LogicalOperator.AND;
        filter_0.FilterType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.FilterType.Normal;

        // Filter filter_1
        const filter_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter_1.Name = "Version";
        filter_1.ObjectName = "AutomationController";
        filter_1.ObjectAlias = "AutomationController_1";
        filter_1.Operator = this.framework.LBOS.Cmf.Foundation.Common.FieldOperator.IsEqualTo;
        filter_1.Value = "0";
        filter_1.LogicalOperator = this.framework.LBOS.Cmf.Foundation.Common.LogicalOperator.AND;
        filter_1.FilterType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.FilterType.Normal;

        // Filter filter_2
        const filter_2 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter_2.Name = "IsDefaultRevision";
        filter_2.ObjectName = "AutomationController";
        filter_2.ObjectAlias = "AutomationController_1";
        filter_2.Operator = this.framework.LBOS.Cmf.Foundation.Common.FieldOperator.IsEqualTo;
        filter_2.Value = true;
        filter_2.LogicalOperator = this.framework.LBOS.Cmf.Foundation.Common.LogicalOperator.Nothing;
        filter_2.FilterType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.FilterType.Normal;

        filterCollection.push(filter_0);
        filterCollection.push(filter_1);
        filterCollection.push(filter_2);

        const fieldCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FieldCollection();

        // Field field_0
        const field_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_0.Alias = "Id";
        field_0.ObjectName = "AutomationController";
        field_0.ObjectAlias = "AutomationController_1";
        field_0.IsUserAttribute = false;
        field_0.Name = "Id";
        field_0.Position = 0;
        field_0.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_1
        const field_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_1.Alias = "DefinitionId";
        field_1.ObjectName = "AutomationController";
        field_1.ObjectAlias = "AutomationController_1";
        field_1.IsUserAttribute = false;
        field_1.Name = "DefinitionId";
        field_1.Position = 1;
        field_1.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_2
        const field_2 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_2.Alias = "Revision";
        field_2.ObjectName = "AutomationController";
        field_2.ObjectAlias = "AutomationController_1";
        field_2.IsUserAttribute = false;
        field_2.Name = "Revision";
        field_2.Position = 2;
        field_2.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_3
        const field_3 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_3.Alias = "Name";
        field_3.ObjectName = "AutomationController";
        field_3.ObjectAlias = "AutomationController_1";
        field_3.IsUserAttribute = false;
        field_3.Name = "Name";
        field_3.Position = 3;
        field_3.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_4
        const field_4 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_4.Alias = "Description";
        field_4.ObjectName = "AutomationController";
        field_4.ObjectAlias = "AutomationController_1";
        field_4.IsUserAttribute = false;
        field_4.Name = "Description";
        field_4.Position = 4;
        field_4.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        fieldCollection.push(field_0);
        fieldCollection.push(field_1);
        fieldCollection.push(field_2);
        fieldCollection.push(field_3);
        fieldCollection.push(field_4);


        const query = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.QueryObject();
        query.Description = "";
        query.EntityTypeName = "AutomationController";
        query.Name = "CustomGetAutomationControllerList";
        query.Query = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Query();
        query.Query.Distinct = false;
        query.Query.Filters = filterCollection;
        query.Query.Fields = fieldCollection;

        return await this.executeQuery(query);
    }

    public async queryControllerVersionList(name: string) {
        const filterCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FilterCollection();

        // Filter filter_0
        const filter_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter_0.Name = "Name";
        filter_0.ObjectName = "AutomationController";
        filter_0.ObjectAlias = "AutomationController_1";
        filter_0.Operator = this.framework.LBOS.Cmf.Foundation.Common.FieldOperator.IsEqualTo;
        filter_0.Value = name;
        filter_0.LogicalOperator = this.framework.LBOS.Cmf.Foundation.Common.LogicalOperator.AND;
        filter_0.FilterType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.FilterType.Normal;

        // Filter filter_1
        const filter_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Filter();
        filter_1.Name = "Version";
        filter_1.ObjectName = "AutomationController";
        filter_1.ObjectAlias = "AutomationController_1";
        filter_1.Operator = this.framework.LBOS.Cmf.Foundation.Common.FieldOperator.GreaterThanOrEqualTo;
        filter_1.Value = "0";
        filter_1.LogicalOperator = this.framework.LBOS.Cmf.Foundation.Common.LogicalOperator.Nothing;
        filter_1.FilterType = this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Enums.FilterType.Normal;

        filterCollection.push(filter_0);
        filterCollection.push(filter_1);

        const fieldCollection = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.FieldCollection();

        // Field field_0
        const field_0 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_0.Alias = "Id";
        field_0.ObjectName = "AutomationController";
        field_0.ObjectAlias = "AutomationController_1";
        field_0.IsUserAttribute = false;
        field_0.Name = "Id";
        field_0.Position = 0;
        field_0.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_1
        const field_1 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_1.Alias = "DefinitionId";
        field_1.ObjectName = "AutomationController";
        field_1.ObjectAlias = "AutomationController_1";
        field_1.IsUserAttribute = false;
        field_1.Name = "DefinitionId";
        field_1.Position = 1;
        field_1.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_2
        const field_2 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_2.Alias = "Revision";
        field_2.ObjectName = "AutomationController";
        field_2.ObjectAlias = "AutomationController_1";
        field_2.IsUserAttribute = false;
        field_2.Name = "Revision";
        field_2.Position = 2;
        field_2.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_3
        const field_3 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_3.Alias = "Name";
        field_3.ObjectName = "AutomationController";
        field_3.ObjectAlias = "AutomationController_1";
        field_3.IsUserAttribute = false;
        field_3.Name = "Name";
        field_3.Position = 3;
        field_3.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_4
        const field_4 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_4.Alias = "UniversalState";
        field_4.ObjectName = "AutomationController";
        field_4.ObjectAlias = "AutomationController_1";
        field_4.IsUserAttribute = false;
        field_4.Name = "UniversalState";
        field_4.Position = 4;
        field_4.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_5
        const field_5 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_5.Alias = "RevisionState";
        field_5.ObjectName = "AutomationController";
        field_5.ObjectAlias = "AutomationController_1";
        field_5.IsUserAttribute = false;
        field_5.Name = "RevisionState";
        field_5.Position = 5;
        field_5.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_6
        const field_6 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_6.Alias = "RevisionSequence";
        field_6.ObjectName = "AutomationController";
        field_6.ObjectAlias = "AutomationController_1";
        field_6.IsUserAttribute = false;
        field_6.Name = "RevisionSequence";
        field_6.Position = 6;
        field_6.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_7
        const field_7 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_7.Alias = "IsDefaultRevision";
        field_7.ObjectName = "AutomationController";
        field_7.ObjectAlias = "AutomationController_1";
        field_7.IsUserAttribute = false;
        field_7.Name = "IsDefaultRevision";
        field_7.Position = 7;
        field_7.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;

        // Field field_8
        const field_8 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_8.Alias = "Version";
        field_8.ObjectName = "AutomationController";
        field_8.ObjectAlias = "AutomationController_1";
        field_8.IsUserAttribute = false;
        field_8.Name = "Version";
        field_8.Position = 8;
        field_8.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.Descending;

        // Field field_9
        const field_9 = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Field();
        field_9.Alias = "Description";
        field_9.ObjectName = "AutomationController";
        field_9.ObjectAlias = "AutomationController_1";
        field_9.IsUserAttribute = false;
        field_9.Name = "Description";
        field_9.Position = 9;
        field_9.Sort = this.framework.LBOS.Cmf.Foundation.Common.FieldSort.NoSort;


        fieldCollection.push(field_0);
        fieldCollection.push(field_1);
        fieldCollection.push(field_2);
        fieldCollection.push(field_3);
        fieldCollection.push(field_4);
        fieldCollection.push(field_5);
        fieldCollection.push(field_6);
        fieldCollection.push(field_7);
        fieldCollection.push(field_8);
        fieldCollection.push(field_9);


        const query = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.QueryObject();
        query.Description = "";
        query.EntityTypeName = "AutomationController";
        query.Name = "CustomGetAutomationControllerVersions";
        query.Query = new this.framework.LBOS.Cmf.Foundation.BusinessObjects.QueryObject.Query();
        query.Query.Distinct = false;
        query.Query.Filters = filterCollection;
        query.Query.Fields = fieldCollection;

        return await this.executeQuery(query);
    }

    public async executeQuery(query: any): Promise<any> {
        try {
            let input = new this.framework.LBOS.Cmf.Foundation.BusinessOrchestration.QueryManagement.InputObjects.ExecuteQueryInput();
            input.QueryObject = query;
            let output = await this.framework.system.call(input);
            if (output.NgpDataSet && output.NgpDataSet["T_Result"]) {
                return output.NgpDataSet["T_Result"];
            }
        } catch (ex: any) {
            console.log(ex.Message);
            // this.framework.logger.error(ex.Message);
            return undefined;
        }
    }
}