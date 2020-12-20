import { AbstractNukIDevice } from './abstract-nuki-device';
import { API, CharacteristicSetCallback, CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge';
import { NukiBridgeApi } from '../api/nuki-bridge-api';
import { NukiDeviceTypes } from '../api/nuki-device-types';
import { NukiDeviceState } from '../api/nuki-device-state';
import { NukiOpenerAction } from '../api/nuki-opener-action';


export class NukiOpenerDevice extends AbstractNukIDevice {


    private readonly _lockService: Service;

    private readonly _doorRingSignalService: Service;

    private readonly _characteristic: any;

    private bellRingLightOn = false;

    private isOpening = false;

    private isOpen = false;

    constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, accessory: PlatformAccessory) {
        super(api, log, nukiApi, NukiDeviceTypes.Opener, accessory);
        this._characteristic = this._api.hap.Characteristic;

        this._lockService = this.getOrAddService(api.hap.Service.LockMechanism, 'Opener Öffnen');
        this._lockService.getCharacteristic(api.hap.Characteristic.LockTargetState)
            .on('get', this.handleLockSwitchGet.bind(this))
            .on('set', this.handleLockSwitchSet.bind(this));

        this._lockService.getCharacteristic(api.hap.Characteristic.LockCurrentState)
            .on('get', this.handleLockCurrentSwitchGet.bind(this))
            .on('set', this.handleLockCurrentSwitchSet.bind(this));


        this._doorRingSignalService = this.getOrAddService(api.hap.Service.Lightbulb, 'Door-Ring Indicator');

        this._doorRingSignalService.getCharacteristic(api.hap.Characteristic.On)
            .on('get', this.handleDoorRingGet.bind(this))   //todo richitig so ?
            .on('set', this.handleDoorRingSet.bind(this));

        this._informationService
            .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Nuki')
            .setCharacteristic(api.hap.Characteristic.Model, 'Opener')
            .setCharacteristic(api.hap.Characteristic.SerialNumber, this.id);
    }

    update(lastKnownState: NukiDeviceState) {
        this._log.debug('lastKnownState Opener', lastKnownState);
    }

    handleDoorRingGet(callback: CharacteristicSetCallback) {
        this._log.info('Current state of the switch was returned: ' + (this.bellRingLightOn ? 'ON' : 'OFF'));
        callback(null, this.bellRingLightOn);
    }

    handleDoorRingSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (value) {
            this._log.debug('RING RING RING RING');
            this.bellRingLightOn = true;
            setTimeout(() => {
                this._doorRingSignalService.setCharacteristic(this._characteristic.On, false);
            }, 500);
            return callback(null);
        } else {
            this._log.debug('RING turned off');
            this.bellRingLightOn = false;
            return callback(null);
        }
    }

    handleLockSwitchSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {

        this._log.debug('Opener called lockmechanism  value = ' + value);
        if (value === this._characteristic.LockTargetState.SECURED) {
            this._lockService.updateCharacteristic(this._characteristic.LockCurrentState,
                this._characteristic.LockCurrentState.SECURED);
            this._lockService.updateCharacteristic(this._characteristic.LockTargetState,
                this._characteristic.LockTargetState.SECURED);
            callback(null);
        } else {
            this._nukiApi.lockAction(this.id, NukiDeviceTypes.Opener, NukiOpenerAction.ELETRIC_STRIKE_ACTUATION).then(() => {
                setTimeout(() => {
                    this._lockService.updateCharacteristic(this._characteristic.LockCurrentState,
                        this._characteristic.LockCurrentState.UNSECURED);
                    this._lockService.updateCharacteristic(this._characteristic.LockTargetState,
                        this._characteristic.LockTargetState.UNSECURED);
                }, 500);

                setTimeout(() => {
                    this._lockService.updateCharacteristic(this._characteristic.LockCurrentState,
                        this._characteristic.LockCurrentState.SECURED);
                    this._lockService.updateCharacteristic(this._characteristic.LockTargetState,
                        this._characteristic.LockTargetState.SECURED);
                }, 1000);

                callback(null);
            }).catch((err) => {
                this._log.error(err);
                callback(err);
            });
        }
    }

    handleLockSwitchGet(callback: CharacteristicSetCallback) {
        this._log.debug('Opener called lockmechanism target Get');
        callback(null, !this.isOpening);
    }

    handleLockCurrentSwitchSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        this._log.debug('Opener called lockmechanism current Set value = ' + value);
        callback(null);
    }

    handleLockCurrentSwitchGet(callback: CharacteristicSetCallback) {
        this._log.debug('Opener called lockmechanism current Get');
        callback(null, !this.isOpen);
    }
}
