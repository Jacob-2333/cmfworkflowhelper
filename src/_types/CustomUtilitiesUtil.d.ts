/**
 * Generic Utilities Task
 */
export interface CustomUtilitiesUtil {
    createHashCode(stringToHash: string): number;
    resolveSmartTable(framework: any, contextTableKeys: Map<string, any>,
        contextResolveValues: Map<string, any>, mappingTablePersistedName: string, configurationTable: string, onlyFirstRow: boolean = false): Promise<any>;
    resetTableMapping(framework: any, mappingTablePersistedName: string): Promise<void>
    store(framework: any, identifier: string, data: any, location: DataStoreLocation): Promise<void>;
    isNullOrUndefined(value: any): boolean;

}