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
import { NukiDeviceState } from '../api/nuki-device-state';
import { NukiSmartLockConfig } from './nuki-smart-lock-config';


class Characteristic {
}

export class NukiSmartLockDevice extends AbstractNukIDevice {

    static BATTERY_LEVEL = 50;

    static RESET_STATE_TIMEOUT = 1500;
    //todo: get from config else take default
    static UNLATCH_NAME = 'Unlatch Door';

    static LOCK_NAME = 'Lock Door';

    static DOOR_OPEN_SENSOR_NAME = 'Contact Sensor';

    private readonly _config: NukiSmartLockConfig;

    private readonly _batteryService: Service;

    private _contactSensorService: Service | undefined;

    private readonly _unlatchService: Service;

    private readonly _unsecureLockService: Service | undefined;

    private readonly _secureLockService: Service | undefined;

    private readonly _characteristics: any;

    constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, accessory: PlatformAccessory, config: NukiSmartLockConfig) {
        super(api, log, nukiApi, NukiDeviceTypes.SmartLock, accessory);

        this._config = config;
        this._characteristics = this._api.hap.Characteristic;

        this._batteryService = this.getOrAddService(api.hap.Service.BatteryService);
        this._batteryService.updateCharacteristic(this._characteristics.BatteryLevel, NukiSmartLockDevice.BATTERY_LEVEL);
        this._batteryService.updateCharacteristic(
            this._characteristics.ChargingState,
            this._characteristics.ChargingState.NOT_CHARGEABLE,
        );

        this._contactSensorService = this._accessory.getService(api.hap.Service.ContactSensor);

        this._unlatchService = this.getOrAddService(api.hap.Service.LockMechanism, NukiSmartLockDevice.UNLATCH_NAME, 'unlatchService');
        this._unlatchService.getCharacteristic(this._characteristics.LockTargetState)
            .on('set', this.handleUnlatchTargetStateSet.bind(this));

        if(this._config.unsecureLockService){
            this._unsecureLockService = this.getOrAddService(api.hap.Service.Switch, NukiSmartLockDevice.LOCK_NAME +' unsecured');
            this._unsecureLockService.getCharacteristic(this._characteristics.On)
                .on('set', this.handleLockSwitchSet.bind(this));
        }

        if(this._config.secureLockService){
            this._secureLockService = this.getOrAddService(api.hap.Service.LockMechanism, NukiSmartLockDevice.LOCK_NAME, 'unlockService');
            this._secureLockService.getCharacteristic(this._characteristics.LockTargetState)
                .on('set', this.handleLockSwitchSet.bind(this));
        }

        this._informationService
            .setCharacteristic(this._characteristics.Manufacturer, 'Nuki')
            .setCharacteristic(this._characteristics.Model, 'SmartLock')
            .setCharacteristic(this._characteristics.SerialNumber, this.id);

    }
    //todo: use or delete
    handleBatteryLevelGet(callback: CharacteristicGetCallback) {
        callback(null, 50);
    }

    handleUnlatchTargetStateSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {

        if ((this._secureLockService?.getCharacteristic(this._characteristics.LockCurrentState).value === this._characteristics.LockCurrentState.SECURED ||
            this._unsecureLockService?.getCharacteristic(this._characteristics.On).value === !!NukiLockState.LOCKED) && !this._config.unlatchWhenLocked) {

            this._unlatchService.updateCharacteristic(
                this._characteristics.LockCurrentState,
                this._characteristics.LockCurrentState.SECURED
            );
            this._unlatchService.updateCharacteristic(
                this._characteristics.LockTargetState,
                this._characteristics.LockTargetState.SECURED);
            return;
        }

        this._nukiApi.lockAction(this.id, NukiDeviceTypes.SmartLock, NukiLockAction.UNLATCH).then(() => {
            this._unlatchService.updateCharacteristic(
                this._characteristics.LockCurrentState,
                this._characteristics.LockCurrentState.UNSECURED,
            );
        }).catch((err) => {
            this._log.error(err);
        });

        callback(null);
    }

    handleLockSwitchSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
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

    update(lastKnownBridgeState: NukiDeviceState) {
        //this._log.debug('lastKnownBridgeState Lock', lastKnownBridgeState);

        // Update Lock.
        if (this._unsecureLockService) {
            this._unsecureLockService.updateCharacteristic(
                this._characteristics.On,
                lastKnownBridgeState.state === NukiLockState.LOCKED
            );

        }

        if (this._secureLockService) {
            let lockCurrentState = this._unlatchService.getCharacteristic(this._characteristics.LockCurrentState).value;
            let lockTargetState = this._unlatchService.getCharacteristic(this._characteristics.LockTargetState).value;

            switch (lastKnownBridgeState.state) {
                case NukiLockState.LOCKED:
                    lockCurrentState = this._characteristics.LockCurrentState.SECURED;
                    lockTargetState = this._characteristics.LockTargetState.SECURED;
                    break;

                case NukiLockState.LOCKING:
                    lockCurrentState = this._characteristics.LockCurrentState.UNSECURED;
                    lockTargetState = this._characteristics.LockTargetState.SECURED;
                    break;

                case NukiLockState.MOTOR_BLOCKED:
                    lockCurrentState = this._characteristics.LockCurrentState.JAMMED;
                    break;

                case NukiLockState.UNCALIBRATED:
                    lockCurrentState = this._characteristics.LockCurrentState.JAMMED;
                    break;

                case NukiLockState.UNDEFINED:
                    lockCurrentState = this._characteristics.LockCurrentState.UNKNOWN;
                    lockTargetState = this._characteristics.LockCurrentState.UNKNOWN;
                    break;

                case NukiLockState.UNLATCHED:
                    lockCurrentState = this._characteristics.LockCurrentState.UNSECURED;
                    lockTargetState = this._characteristics.LockTargetState.UNSECURED;
                    break;

                case NukiLockState.UNLATCHING:
                    lockTargetState = this._characteristics.LockTargetState.UNSECURED;
                    break;

                case NukiLockState.UNLOCKED:
                    lockCurrentState = this._characteristics.LockCurrentState.UNSECURED;
                    lockTargetState = this._characteristics.LockTargetState.UNSECURED;
                    break;

                case NukiLockState.UNLOCKED_LOCK_AND_GO:
                    lockTargetState = this._characteristics.LockTargetState.SECURED;
                    break;

                case NukiLockState.UNLOCKING:
                    lockTargetState = this._characteristics.LockTargetState.UNSECURED;
                    break;
            }

            this._secureLockService.updateCharacteristic(
                this._characteristics.LockCurrentState,
                lockCurrentState as CharacteristicValue,
            );
            this._secureLockService.updateCharacteristic(
                this._characteristics.LockTargetState,
                lockTargetState as CharacteristicValue,
            );
        }

        if(this._unlatchService) {
            // Update Unlatch Lock.
            if (lastKnownBridgeState.state === NukiLockState.UNLATCHING
                || lastKnownBridgeState.state === NukiLockState.UNLATCHED) {
                this._unlatchService.updateCharacteristic(
                    this._characteristics.LockCurrentState,
                    this._characteristics.LockCurrentState.UNSECURED,
                );
                this._unlatchService.updateCharacteristic(
                    this._characteristics.LockTargetState,
                    this._characteristics.LockTargetState.UNSECURED,
                );
            } else {
                this._unlatchService.updateCharacteristic(
                    this._characteristics.LockCurrentState,
                    this._characteristics.LockCurrentState.SECURED,
                );
                this._unlatchService.updateCharacteristic(
                    this._characteristics.LockTargetState,
                    this._characteristics.LockTargetState.SECURED,
                );
            }
        }

        // Update Battery.
        if (lastKnownBridgeState.batteryCritical) {
            this._batteryService.updateCharacteristic(
                this._characteristics.StatusLowBattery,
                this._characteristics.StatusLowBattery.BATTERY_LEVEL_LOW,
            );
        } else {
            this._batteryService.updateCharacteristic(
                this._characteristics.StatusLowBattery,
                this._characteristics.StatusLowBattery.BATTERY_LEVEL_NORMAL,
            );
        }

        // Update Door Sensor.
        if (lastKnownBridgeState.doorsensorState === NukiDoorSensorState.DEACTIVATED) {
            if (this._contactSensorService) {
                this._accessory.removeService(this._contactSensorService);
                this._contactSensorService = undefined;
            }

        } else {
            if (!this._contactSensorService) {
                this._contactSensorService = this._accessory.addService(
                    this._api.hap.Service.ContactSensor,
                    NukiSmartLockDevice.DOOR_OPEN_SENSOR_NAME,
                );
                this._contactSensorService.getCharacteristic(this._characteristics.ContactSensorState);
            }

            const isFault = lastKnownBridgeState.doorsensorState === NukiDoorSensorState.CALIBRATING
                || lastKnownBridgeState.doorsensorState === NukiDoorSensorState.DOOR_STATE_UNKNOWN;

            if (isFault) {
                this._contactSensorService.updateCharacteristic(
                    this._characteristics.StatusFault,
                    this._characteristics.StatusFault.GENERAL_FAULT,
                );
            } else {
                let contactSensorState;
                if (lastKnownBridgeState.doorsensorState === NukiDoorSensorState.DOOR_OPENED) {
                    contactSensorState = this._characteristics.ContactSensorState.CONTACT_NOT_DETECTED;
                } else {
                    contactSensorState = this._characteristics.ContactSensorState.CONTACT_DETECTED;
                }
                this._contactSensorService.updateCharacteristic(
                    this._characteristics.ContactSensorState,
                    contactSensorState,
                );
                this._contactSensorService.updateCharacteristic(
                    this._characteristics.StatusFault,
                    this._characteristics.StatusFault.NO_FAULT,
                );
            }
        }

    }
}

