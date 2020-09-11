import { API, Logging, PlatformAccessory } from 'homebridge';
import { NukiSmartLockDevice } from './nuki-smart-lock-device';
import { NukiDeviceTypes } from '../api/nuki-device-types';
import { AbstractNukIDevice } from './abstract-nuki-device';
import { NukiBridgeManager } from '../api/nuki-bridge-manager';
import { NukiOpenerDevice } from './nuki-opener-device';
import { NukiPlatformConfig } from '../nuki-platform-config';
import { NUKI_SMART_LOCK_DEFAULT_CONFIG } from "./nuki-smart-lock-config";

export class AbstractNukiDeviceFactory {

    private readonly log: Logging;

    private readonly api: API;

    private readonly nukiBridgeManager: NukiBridgeManager;

    private readonly config: NukiPlatformConfig;

    constructor(log: Logging, api: API, nukiBridgeManager: NukiBridgeManager, config: NukiPlatformConfig) {
        this.log = log;
        this.api = api;
        this.nukiBridgeManager = nukiBridgeManager;
        this.config = config;
    }

    fromDeviceType(id: string, name: string, deviceType: NukiDeviceTypes, bridgeId: number): AbstractNukIDevice | undefined {
        const uuid = this.api.hap.uuid.generate(id.toString());
        const accessory = new this.api.platformAccessory(name, uuid);
        accessory.context.id = id;
        accessory.context.deviceType = deviceType;
        accessory.context.bridgeId = bridgeId;

        return this.fromAccessory(accessory);
    }

    fromAccessory(accessory: PlatformAccessory): AbstractNukIDevice | undefined {
        const bridge = this.nukiBridgeManager.getById(accessory.context.bridgeId);
        if (!bridge) {
            this.log.warn(`no bridge found with id=${accessory.context.bridgeId} for accessory ${accessory.UUID}`);
            return undefined;
        }

        switch (accessory.context.deviceType) {
            case NukiDeviceTypes.SmartLock:
                let config = this.config.smartLocks.find(_ => _.id === accessory.context.id);
                if (config) {
                    this.log.debug('found specific device config for SmartLock', config);
                }
                config = Object.assign(NUKI_SMART_LOCK_DEFAULT_CONFIG, config, {
                    id: accessory.context.id,
                });
                return new NukiSmartLockDevice(this.api, this.log, bridge, accessory, config);

            case NukiDeviceTypes.Opener:
                return new NukiOpenerDevice(this.api, this.log, bridge, accessory);
        }
    }
}
