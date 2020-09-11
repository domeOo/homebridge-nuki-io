import {
    API,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    Logging,
    PlatformAccessory,
    Service,
} from 'homebridge';
import { AbstractNukIDevice } from './abstract-nuki-device';
import { NukiBridgeApi } from '../api/nuki-bridge-api';
import { NukiDeviceTypes } from '../api/nuki-device-types';
import { NukiLockAction } from '../api/nuki-lock-action';
import { NukiLockState } from '../api/nuki-lock-state';
import { NukiDoorSensorState } from '../api/nuki-door-sensor-state';


export class NukiSmartLockDevice extends AbstractNukIDevice {

    private readonly batteryService: Service;

    private contactSensorService: Service | undefined;

    private readonly unlatchService: Service;

    private readonly lockService: Service;

    private readonly informationService: Service;

    private _timeout: NodeJS.Timeout | undefined;

    constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, accessory: PlatformAccessory) {
        super(api, log, nukiApi, NukiDeviceTypes.SmartLock, accessory);

        this.batteryService = this.getOrAddService(api.hap.Service.BatteryService);
        this.batteryService.updateCharacteristic(api.hap.Characteristic.BatteryLevel, 50);
        this.batteryService.updateCharacteristic(api.hap.Characteristic.ChargingState, api.hap.Characteristic.ChargingState.NOT_CHARGEABLE);

        this.contactSensorService = this._accessory.getService(api.hap.Service.ContactSensor);

        this.unlatchService = this.getOrAddService(api.hap.Service.LockMechanism, 'Unlatch Door');
        this.unlatchService.getCharacteristic(api.hap.Characteristic.LockTargetState)
            .on('set', this.handleLockTargetStateSet.bind(this));

        this.lockService = this.getOrAddService(api.hap.Service.Switch, 'Lock Door');
        this.lockService.getCharacteristic(api.hap.Characteristic.On)
            .on('set', this.handleOnSet.bind(this));

        this.informationService = this._informationService
            .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Nuki')
            .setCharacteristic(api.hap.Characteristic.Model, 'SmartLock')
            .setCharacteristic(api.hap.Characteristic.SerialNumber, this.id);
    }

    handleBatteryLevelGet(callback: CharacteristicGetCallback) {
        callback(null, 50);
    }

    handleLockTargetStateSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (value !== this._api.hap.Characteristic.LockCurrentState.UNSECURED) {
            this.unlatchService.updateCharacteristic(this._api.hap.Characteristic.LockCurrentState, value);
            return callback(null);
        }

        this._nukiApi.lockAction(this.id, NukiDeviceTypes.SmartLock, NukiLockAction.UNLATCH).then(() => {
            if (this._timeout) {
                clearTimeout(this._timeout);
            }

            this._timeout = setTimeout(() => {
                this.unlatchService.updateCharacteristic(
                    this._api.hap.Characteristic.LockCurrentState,
                    this._api.hap.Characteristic.LockCurrentState.UNSECURED,
                );
                this.unlatchService.updateCharacteristic(
                    this._api.hap.Characteristic.LockTargetState,
                    this._api.hap.Characteristic.LockTargetState.UNSECURED,
                );
            }, 3000);

            callback(null);
        }).catch((err) => {
            this._log.error(err);
            callback(err);
        });
    }

    handleOnSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        let action: NukiLockAction;
        if (value) {
            action = NukiLockAction.LOCK;
        } else {
            action = NukiLockAction.UNLOCK;
        }

        this._nukiApi.lockAction(this.id, NukiDeviceTypes.SmartLock, action).then(() => {
            callback(null);
        }).catch((err) => {
            this._log.error(err);
            callback(err);
        });
    }

    // eslint-disable-next-line max-len
    update(state: { mode: number, state: NukiLockState, stateName: string, batteryCritical: boolean, doorsensorState: NukiDoorSensorState, doorsensorStateName: string }) {
        console.log(state);

        let unlatchCurrentState = this.unlatchService.getCharacteristic(this._api.hap.Characteristic.LockCurrentState).value;
        let unlatchTargetState = this.unlatchService.getCharacteristic(this._api.hap.Characteristic.LockTargetState).value;
        let lockOn = this.lockService.getCharacteristic(this._api.hap.Characteristic.On).value;

        switch (state.state) {
            case NukiLockState.LOCKED:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.SECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                lockOn = true;
                break;

            case NukiLockState.LOCKING:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                break;

            case NukiLockState.MOTOR_BLOCKED:
                unlatchTargetState = this._api.hap.Characteristic.LockCurrentState.JAMMED;
                break;

            case NukiLockState.UNCALIBRATED:
                unlatchTargetState = this._api.hap.Characteristic.LockCurrentState.JAMMED;
                break;

            case NukiLockState.UNDEFINED:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNKNOWN;
                unlatchTargetState = this._api.hap.Characteristic.LockCurrentState.UNKNOWN;
                break;

            case NukiLockState.UNLATCHED:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                break;

            case NukiLockState.UNLATCHING:
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                break;

            case NukiLockState.UNLOCKED:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                lockOn = false;
                break;

            case NukiLockState.UNLOCKED_LOCK_AND_GO:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                break;

            case NukiLockState.UNLOCKING:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.SECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                break;
        }

        this.unlatchService.updateCharacteristic(this._api.hap.Characteristic.LockCurrentState, unlatchCurrentState as any);
        this.unlatchService.updateCharacteristic(this._api.hap.Characteristic.LockTargetState, unlatchTargetState);
        this.lockService.updateCharacteristic(this._api.hap.Characteristic.On, lockOn as any);

        if (state.doorsensorState === NukiDoorSensorState.DEACTIVATED) {
            if (this.contactSensorService) {
                this._accessory.removeService(this.contactSensorService);
                this.contactSensorService = undefined;
            }

        } else {
            if (!this.contactSensorService) {
                this.contactSensorService = this._accessory.addService(this._api.hap.Service.ContactSensor, 'Contact Sensor');
                this.contactSensorService.getCharacteristic(this._api.hap.Characteristic.ContactSensorState);
            }

            const isFault = state.doorsensorState === NukiDoorSensorState.CALIBRATING
                || state.doorsensorState === NukiDoorSensorState.DOOR_STATE_UNKNOWN;

            if (isFault) {
                this.contactSensorService.updateCharacteristic(
                    this._api.hap.Characteristic.StatusFault,
                    this._api.hap.Characteristic.StatusFault.GENERAL_FAULT,
                );
            } else {
                let contactSensorState;
                if (state.doorsensorState === NukiDoorSensorState.DOOR_OPENED) {
                    contactSensorState = this._api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
                } else {
                    contactSensorState = this._api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                }
                this.contactSensorService.updateCharacteristic(
                    this._api.hap.Characteristic.ContactSensorState,
                    contactSensorState,
                );
                this.contactSensorService.updateCharacteristic(
                    this._api.hap.Characteristic.StatusFault,
                    this._api.hap.Characteristic.StatusFault.NO_FAULT,
                );
            }
        }

    }
}

