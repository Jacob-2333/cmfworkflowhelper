import * as LBOS from 'cmf-lbos';
import { CustomUtilitiesApi } from './CustomUtilitiesApi';
import { CustomUtilitiesUtil } from './CustomUtilitiesUtil';
import { Logger, DataStore, MessageBus, SystemAPI, Utils } from './BaseUtilities';

/**
 * Access to the CMF Framework
 */
export interface Framework {

    /** Used to perform log operations */
    logger: Logger;

    /** Used to store and retrieve values */
    dataStore: DataStore;

    /** Message Bus access */
    messageBus: MessageBus;

    /** System (MES) access */
    system: SystemAPI;

    /** System (MES) access */
    LBOS: typeof LBOS;

    /** Utilities */
    utils: Utils;

    customApis: CustomUtilitiesApi;
    customUtilities: CustomUtilitiesUtil;
}