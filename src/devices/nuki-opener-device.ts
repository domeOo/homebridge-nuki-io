import { AbstractNukIDevice } from './abstract-nuki-device';
import { API, CharacteristicSetCallback, CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge';
import { NukiBridgeApi } from '../api/nuki-bridge-api';
import { NukiDeviceTypes } from '../api/nuki-device-types';
import { NukiDeviceState } from '../api/nuki-device-state';


export class NukiOpenerDevice extends AbstractNukIDevice {


    private readonly _lockService: Service;

    private readonly _doorRingSignalService: Service;

    private readonly _characteristic: any;

    private bellRingLightOn = false;


    constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, accessory: PlatformAccessory) {
        super(api, log, nukiApi, NukiDeviceTypes.Opener, accessory);
        this._characteristic = this._api.hap.Characteristic;

        this._lockService = this.getOrAddService(api.hap.Service.LockMechanism, 'Opener Öffnen');
        this._lockService.getCharacteristic(api.hap.Characteristic.LockTargetState)
            .on('set', this.handleLockSwitchSet.bind(this));

        this._doorRingSignalService = this.getOrAddService(api.hap.Service.Lightbulb, 'Door Ring Indcator');
        this._doorRingSignalService.getCharacteristic(api.hap.Characteristic.On)
            .on('set', this.handleDoorRingSet.bind(this));//todo richitig so ?
        this._doorRingSignalService.getCharacteristic(api.hap.Characteristic.On)
            .on('get', this.handleDoorRingGet.bind(this));


        this._informationService
            .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Nuki')
            .setCharacteristic(api.hap.Characteristic.Model, 'Opener')
            .setCharacteristic(api.hap.Characteristic.SerialNumber, this.id);
    }

    update(lastKnownState: NukiDeviceState) {
    }

    handleDoorRingGet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        this._log.info("Current state of the switch was returned: " + (this.bellRingLightOn? "ON": "OFF"));
        callback(null, this.bellRingLightOn);
    }

    handleDoorRingSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        this._log.debug("RING RING RING RING")
        this._doorRingSignalService.updateCharacteristic(this._characteristic.On, false);
        callback(null, false);
    }


    handleLockSwitchSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (value !== this._characteristic.LockTargetState.UNSECURED) {
            setTimeout(() => {
                this._lockService.updateCharacteristic(this._characteristic.LockTargetState.LockCurrentState, this._characteristic.LockTargetState.LockCurrentState.SECURED);
                this._lockService.updateCharacteristic(this._characteristic.LockTargetState.LockTargetState, this._characteristic.LockTargetState.LockTargetState.SECURED);
            }, 500);
            return callback(null);
        }

        this._nukiApi.lockAction(this.id, NukiDeviceTypes.Opener, 3).then(() => {
            callback(null);
        }).catch((err) => {
            this._log.error(err);
            callback(err);
        });
    }
}
