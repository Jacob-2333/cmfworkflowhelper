import { System } from '@criticalmanufacturing/connect-iot-controller-engine';
/**
 * Generic Utilities api Task
 */
export interface CustomUtilitiesApi {
    add(a: number, b: number, c: number): number;
    /**
     * Get net Module by require (Cannot be packed by webpack right now)
     * @returns net
     */
    getNet(): any;
    getObjectByName(framework: any, name: string, type: string, levelsToLoad?: number): Promise<any>;
    getObjectById(framework: any, id: string, type: string, levelsToLoad?: number): Promise<any>;
    getConfiguration(framework: any, path: string): Promise<any>;
    trackOut(framework: any, materialName: string): Promise<any>;
    getMaterialsAtResourceByResourceName(framework: any, resourceName: any): Promise<any>;
    trackInWithoutResourceInfo(framework: any, materialName: string): Promise<any>;
    loadMaterialsByStep(framework: any, stepName: any): Promise<any>;
    changeMaterialQuantity(framework: any, material: any, newPrimaryQuantity: number): Promise<boolean>;
    abortMaterial(framework: any, material: any): Promise<any>;
    rework(framework: any, material: any): Promise<boolean>;
    attachMaterialToContainerByName(framework: any, materialName: any, containerName: any): Promise<System.LBOS.Cmf.Navigo.BusinessObjects.Container>;
    attachMaterialToContainer(framework: any, material: any, container: any): Promise<any>;
    changeStep(framework: any, material: any, flowName: string, botStepN: string, topStepN: string): Promise<boolean>;
    changeMaterialFlowAndStep(framework: any, material: any, flow: any, flowPath: string, step: any): Promise<boolean>;
    disassociateMaterialsFromContainer(framework: any, material: any): Promise<any>;
    loadContainersForMaterial(framework: any, material: any): Promise<any>;
    sendMachineExceptionEmail(framework: any, errorNotificationRoles: any, lineName: string, resourceName: string, error: Error): Promise<any>
    sendEmail(framework: any, userList: string, subject: string, content: string): Promise<any>;

    loadAttribute(framework: any, entity: any, attributeName: string): Promise<any>
    loadAttributes(framework: any, entity: any, specificAttributes?: string[]): Promise<any>;
    executeQuery(framework: any, queryObject: any, parameterCollection?: any): Promise<any>;
    setInstanceSystemState(framework: any, instanceId: string, newState?: System.LBOS.Cmf.Foundation.BusinessObjects.AutomationSystemState,
        newCommunicationState?: System.LBOS.Cmf.Foundation.BusinessObjects.AutomationCommunicationState): Promise<void>;
    expandMaterial(framework:any, material: any, subMaterialNames: any, subMaterialForm: string, subMaterialPrimaryUnits: string): Promise<any>;
    removeMaterialFromLine(framework: any, material: any): Promise<any>;
    moveNext(framework: any, material: any): Promise<any>;
    detachMaterials(framework: any, materialName: any): Promise<any>;
    terminateMaterial(framework: any, materialName: any): Promise<any>;
    undock(framework: any, container: any): Promise<any>;
    throwError(framework: any, errmsg: string): Promise<any>;
    loadPcsQuantityInPanel(framework: any, materialName: string): Promise<number>;
    expandToPanel(framework: any, lotMaterial: any, subMaterialName: string, subMaterialPrimaryQuantity: number, subMaterialForm: string, subMaterialPrimaryUnits: string): Promise<any>;
    attachMaterials(framework: any, materialName: any, subMaterials: any): Promise<any>;
    getMaterialNextStep(framework: any, material: any): Promise<any>;
    nextStepOptional(framework: any, material: any): Promise<boolean>;
    createMaterial(framework: any, name: string, productName: string, resourceName: any, primaryQuantity: number): Promise<any>;
    getBarcodeIdentifyTypesWithIdLength(framework: any, tableName: string, length: number): Promise<any>;
    CreateIoTMaterialForBW(framework: any, id: string, resourceName: string, primaryQuantity: number): Promise<any>;
    getMaterialLastResourceByCustomEntity(framework: any, mateiralName: string): Promise<any>;
    trackOutWithNextLineFlowPath(framework: any, materialName: string, optional: boolean): Promise<any>;
    getDataForMultipleTrackOutAndMoveNextWizard(framework: any, material: any): Promise<any>;
    moveLastStep(framework: any, material: any, stepCount: number): Promise<any>;
    changeNearbyStep(framework: any, material: any, stepName: string): Promise<any>;
    changeFlowStep(framework: any, material: any, flowPath: string, step: string): Promise<any>;
    storageData(framework: any, materialName: string, resourceName: string, data: any, status: string): Promise<any>;
}