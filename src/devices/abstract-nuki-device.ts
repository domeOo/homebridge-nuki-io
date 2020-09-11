import { AbstractAccessory } from './abstract-accessory';
import { API, Logging, PlatformAccessory } from 'homebridge';
import { NukiBridgeApi } from '../api/nuki-bridge-api';
import { NukiDeviceTypes } from '../api/nuki-device-types';
import { NukiDeviceState } from '../api/nuki-device-state';

export abstract class AbstractNukIDevice extends AbstractAccessory {

    protected readonly _deviceType: NukiDeviceTypes;

    protected readonly _nukiApi: NukiBridgeApi;

    protected constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, deviceType: NukiDeviceTypes, accessory: PlatformAccessory) {
        super(api, log, accessory);
        this._deviceType = deviceType;
        this._nukiApi = nukiApi;
    }

    get deviceType(): NukiDeviceTypes {
        return this._deviceType;
    }

    abstract update(lastKnownState: NukiDeviceState);
}
