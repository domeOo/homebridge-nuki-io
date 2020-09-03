import {
    API,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    Logging,
    PlatformAccessory,
    Service
} from 'homebridge';
import { AbstractNukIDevice } from './abstract-nuki-device';
import { NukiBridgeApi } from './nuki-bridge-api';
import { NukiDeviceTypes } from './nuki-device-types';

enum DoorsensorState {
    DEACTIVATED = 1,
    DOOR_CLOSED = 2,
    DOOR_OPENED = 3,
    DOOR_STATE_UNKNOWN = 4,
    CALIBRATING = 5
}

enum LockState {
    UNCALIBRATED = 0,
    LOCKED = 1,
    UNLOCKING = 2,
    UNLOCKED = 3,
    LOCKING = 4,
    UNLATCHED = 5,
    UNLOCKED_LOCK_AND_GO = 6,
    UNLATCHING = 7,
    MOTOR_BLOCKED = 8,
    UNDEFINED = 255
}

export enum LockAction {
    UNLOCK = 1,
    LOCK = 2,
    UNLATCH = 3,
    LOCK_AND_GO = 4,
    LOCK_AND_GO_WITH_UNLATCH = 5
}

export class NukiSmartLockDevice extends AbstractNukIDevice {

    private readonly batteryService: Service;

    private contactSensorService: Service | undefined;

    private readonly unlatchService: Service;

    private readonly lockService: Service;

    private readonly informationService: Service;

    private isBatteryLow = false;

    private isDoorLocked = false;

    private isDoorOpen = false;

    private isDoorLatched = false;

    constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, accessory: PlatformAccessory) {
        super(api, log, nukiApi, NukiDeviceTypes.SmartLock, accessory);

        this.batteryService = this.getOrAddService(api.hap.Service.BatteryService);
        this.batteryService.updateCharacteristic(api.hap.Characteristic.BatteryLevel, 50);
        this.batteryService.updateCharacteristic(api.hap.Characteristic.ChargingState, api.hap.Characteristic.ChargingState.NOT_CHARGEABLE);

        this.contactSensorService = this._accessory.getService(api.hap.Service.ContactSensor);

        this.unlatchService = this.getOrAddService(api.hap.Service.LockMechanism, 'Lock Door');
        this.unlatchService.getCharacteristic(api.hap.Characteristic.LockTargetState)
            .on('set', this.handleLockTargetStateSet.bind(this));

        this.lockService = this.getOrAddService(api.hap.Service.Switch, 'Unlatch Door');
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
        console.log(value);
        let action: LockAction;
        if (value) {
            action = LockAction.UNLATCH;
        } else {
            return callback(null, value);
        }

        this._nukiApi.lockAction(this.id, NukiDeviceTypes.SmartLock, action).then(() => {
            callback(null);
        }).catch((err) => {
            console.log(err);
            callback(err);
        });
    }

    handleOnSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        console.log(value);
        let action: LockAction;
        if (value) {
            action = LockAction.LOCK;
        } else {
            action = LockAction.UNLOCK;
        }

        this._nukiApi.lockAction(this.id, NukiDeviceTypes.SmartLock, action).then(() => {
            callback(null);
        }).catch((err) => {
            console.log(err);
            callback(err);
        });
    }

    // eslint-disable-next-line max-len
    update(state: { mode: number, state: LockState, stateName: string, batteryCritical: boolean, doorsensorState: DoorsensorState, doorsensorStateName: string }) {
        console.log(state);

        let unlatchCurrentState = this.unlatchService.getCharacteristic(this._api.hap.Characteristic.LockCurrentState).value;
        let unlatchTargetState = this.unlatchService.getCharacteristic(this._api.hap.Characteristic.LockTargetState).value;
        let lockOn = this.lockService.getCharacteristic(this._api.hap.Characteristic.On).value;

        switch (state.state) {
            case LockState.LOCKED:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.SECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                lockOn = true;
                break;

            case LockState.LOCKING:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                break;

            case LockState.MOTOR_BLOCKED:
                unlatchTargetState = this._api.hap.Characteristic.LockCurrentState.JAMMED;
                break;

            case LockState.UNCALIBRATED:
                unlatchTargetState = this._api.hap.Characteristic.LockCurrentState.JAMMED;
                break;

            case LockState.UNDEFINED:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNKNOWN;
                unlatchTargetState = this._api.hap.Characteristic.LockCurrentState.UNKNOWN;
                break;

            case LockState.UNLATCHED:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                break;

            case LockState.UNLATCHING:
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                break;

            case LockState.UNLOCKED:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                lockOn = false;
                break;

            case LockState.UNLOCKED_LOCK_AND_GO:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                break;

            case LockState.UNLOCKING:
                unlatchCurrentState = this._api.hap.Characteristic.LockCurrentState.SECURED;
                unlatchTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                break;
        }

        this.unlatchService.updateCharacteristic(this._api.hap.Characteristic.LockCurrentState, unlatchCurrentState as any);
        this.unlatchService.updateCharacteristic(this._api.hap.Characteristic.LockTargetState, unlatchTargetState);
        this.lockService.updateCharacteristic(this._api.hap.Characteristic.On, lockOn as any);

        if (state.doorsensorState === DoorsensorState.DEACTIVATED) {
            if (this.contactSensorService) {
                this._accessory.removeService(this.contactSensorService);
                this.contactSensorService = undefined;
            }

        } else {
            if (!this.contactSensorService) {
                this.contactSensorService = this._accessory.addService(this._api.hap.Service.ContactSensor, 'Contact Sensor');
                this.contactSensorService.getCharacteristic(this._api.hap.Characteristic.ContactSensorState);
            }

            const isFault = state.doorsensorState === DoorsensorState.CALIBRATING
                || state.doorsensorState === DoorsensorState.DOOR_STATE_UNKNOWN;

            if (isFault) {
                this.contactSensorService.updateCharacteristic(this._api.hap.Characteristic.StatusFault, this._api.hap.Characteristic.StatusFault.GENERAL_FAULT);
            } else {
                let contactSensorState;
                if (state.doorsensorState === DoorsensorState.DOOR_OPENED) {
                    contactSensorState = this._api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
                } else {
                    contactSensorState = this._api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                }
                this.contactSensorService.updateCharacteristic(this._api.hap.Characteristic.ContactSensorState, contactSensorState);
                this.contactSensorService.updateCharacteristic(this._api.hap.Characteristic.StatusFault, this._api.hap.Characteristic.StatusFault.NO_FAULT);
            }
        }

    }
}

