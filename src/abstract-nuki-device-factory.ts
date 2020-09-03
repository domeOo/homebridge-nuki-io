import { API, Logging, PlatformAccessory } from "homebridge";
import { NukiSmartLockDevice } from "./nuki-smart-lock-device";
import { NukiDeviceTypes } from "./nuki-device-types";
import { AbstractNukIDevice } from "./abstract-nuki-device";
import { NukiBridgeManager } from "./nuki-bridge-manager";

export class AbstractNukiDeviceFactory {

    private readonly log: Logging;

    private readonly api: API;

    private readonly nukiBridgeManager: NukiBridgeManager;

    constructor(log: Logging, api: API, nukiBridgeManager: NukiBridgeManager) {
        this.log = log;
        this.api = api;
        this.nukiBridgeManager = nukiBridgeManager;
    }

    fromDeviceType(id: string, name: string, deviceType: NukiDeviceTypes, bridgeId: number): AbstractNukIDevice | undefined {
        const uuid = this.api.hap.uuid.generate(id);
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
                return new NukiSmartLockDevice(this.api, this.log, bridge, accessory);
        }
    }
} 
