import { AbstractNukIDevice } from './abstract-nuki-device';
import { API, CharacteristicSetCallback, CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge';
import { NukiBridgeApi } from '../api/nuki-bridge-api';
import { NukiDeviceTypes } from '../api/nuki-device-types';
import { NukiDeviceState } from '../api/nuki-device-state';
import { NukiOpenerAction } from '../api/nuki-opener-action';
import { NukiOpenerState } from '../api/nuki-opener-state';


export class NukiOpenerDevice extends AbstractNukIDevice {


    private readonly _lockService: Service;

    private readonly _doorRingSignalService: Service;

    private readonly _rtoSwitchService: Service;

    private readonly _continuousModeSwitchService: Service;

    private readonly _characteristic: any;

    private bellRingOn = false;

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


        this._doorRingSignalService = this.getOrAddService(api.hap.Service.ContactSensor, 'Door-Ring Indicator');

        this._doorRingSignalService.getCharacteristic(api.hap.Characteristic.ContactSensorState)
            .on('get', this.handleDoorRingGet.bind(this))
            .on('set', this.handleDoorRingSet.bind(this));

        //todo: check if config is user want this
        if (true) {
            this._rtoSwitchService = this.getOrAddService(api.hap.Service.Switch, 'Ring to Open', 'ringToOpen');
            this._continuousModeSwitchService = this.getOrAddService(api.hap.Service.Switch, 'Continuous Mode', 'continuousMode');

        }

        // Subscribes for changes of the RTO mode
        if (this._rtoSwitchService) {
            this._rtoSwitchService.getCharacteristic(this._characteristic.On).on('set', this.handleRtoSwitchServiceSet.bind(this));
        }

        // Subscribes for changes of the continuous mode
        if (this._continuousModeSwitchService) {
            this._continuousModeSwitchService.getCharacteristic(this._characteristic.On).on('set',
                this.handleContinuousModeSwitchServiceSet.bind(this));
        }

        this._informationService
            .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Nuki')
            .setCharacteristic(api.hap.Characteristic.Model, 'Opener')
            .setCharacteristic(api.hap.Characteristic.SerialNumber, this.id);
    }

    update(lastKnownState: NukiDeviceState) {
        this._log.debug('lastKnownState Opener', lastKnownState);

        // Checks if the state exists, which is not the case if the device is unavailable
        if (!lastKnownState) {
            return;
        }

        // Sets the lock state

        if (lastKnownState.state === NukiOpenerState.ONLINE || lastKnownState.state === NukiOpenerState.RTO_ACTIVE) {
            this._log(this.id + ' - Updating lock state: SECURED/SECURED becuas of rto active or online');
            this._lockService.updateCharacteristic(this._characteristic.LockCurrentState, this._characteristic.LockCurrentState.SECURED);
            this._lockService.updateCharacteristic(this._characteristic.LockTargetState, this._characteristic.LockTargetState.SECURED);
        }

        if (lastKnownState.state === NukiOpenerState.OPEN) {
            this._log(this.id + ' - Updating lock state: UNSECURED/UNSECURED becaus of open');
            this._lockService.updateCharacteristic(this._characteristic.LockCurrentState, this._characteristic.LockCurrentState.UNSECURED);
            this._lockService.updateCharacteristic(this._characteristic.LockTargetState, this._characteristic.LockTargetState.UNSECURED);
            //todo: here maybe add option to disable rto after first ring?
        }
        if (lastKnownState.state === NukiOpenerState.OPENING) {
            this._log(this.id + ' - Updating lock state: -/UNSECURED becaus of opening');
            this._lockService.updateCharacteristic(this._characteristic.LockTargetState, this._characteristic.LockTargetState.UNSECURED);
        }
        
        // Sets the ring action state
        if (this._doorRingSignalService && lastKnownState.ringactionState && lastKnownState.state === NukiOpenerState.ONLINE ) {
            this._log.debug('Opener with id: ' +this.id + ' - Updating doorbell: Ring');
            this._doorRingSignalService.setCharacteristic(this._characteristic.ContactSensorState,
                this._characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
        }

        // Sets the status for the continuous mode
        if (this._continuousModeSwitchService) {
            this._log.debug(this.id + ' - Updating Continuous Mode: ' + lastKnownState.mode);
            this._continuousModeSwitchService.updateCharacteristic(this._characteristic.On, lastKnownState.mode === 3);
        }

        // Sets the status for RTO
        if (this._rtoSwitchService) {
            if (lastKnownState.state === NukiOpenerState.ONLINE || lastKnownState.state === NukiOpenerState.RTO_ACTIVE) {
                this._log.debug(this.id + ' - Updating RTO: ' + lastKnownState.state);
                this._rtoSwitchService.updateCharacteristic(this._characteristic.On, lastKnownState.state === NukiOpenerState.RTO_ACTIVE);
            }
        }

        // Sets the status of the battery
        this._log.debug(this.id + ' - Updating critical battery: ' + lastKnownState.batteryCritical);
        if (lastKnownState.batteryCritical) {
            this._lockService.updateCharacteristic(this._characteristic.StatusLowBattery,
                this._characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
        } else {
            this._lockService.updateCharacteristic(this._characteristic.StatusLowBattery,
                this._characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
        }
    }

    handleRtoSwitchServiceSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        this._log.debug(' Opener - Set RTO to ' + value);
        this._nukiApi.lockAction(this.id, NukiDeviceTypes.Opener,
            value ? NukiOpenerAction.ACTIVATE_RTO : NukiOpenerAction.DEACTIVATE_RTO).then(() => {
            callback(null);
        }).catch((err) => {
            this._log.error(err);
            callback(err);
        });
    }

    handleContinuousModeSwitchServiceSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        this._log.debug(' Opener - Set Continuous Mode  to ' + value);
        this._nukiApi.lockAction(this.id, NukiDeviceTypes.Opener,
            value ? NukiOpenerAction.ACTIVATE_CONTINUOUS_MODE : NukiOpenerAction.DEACTIVATE_CONTINUOUS_MODE).then(() => {
            callback(null);
        }).catch((err) => {
            this._log.error(err);
            callback(err);
        });
    }


    handleDoorRingGet(callback: CharacteristicSetCallback) {
        this._log.info('Current state of the switch was returned: ' + (this.bellRingOn ? 'ON' : 'OFF'));

        callback(null, this.bellRingOn ?
            this._characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
            this._characteristic.ContactSensorState.CONTACT_DETECTED);
    }

    handleDoorRingSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (value === this._characteristic.ContactSensorState.CONTACT_NOT_DETECTED) {
            this._log.debug('DING DONG!');
            this.bellRingOn = true;
            setTimeout(() => {
                this._doorRingSignalService.setCharacteristic(this._characteristic.ContactSensorState,
                    this._characteristic.ContactSensorState.CONTACT_DETECTED);
            }, 500);
            return callback(null);
        } else {
            this._log.debug('RING turned off');
            this.bellRingOn = false;
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