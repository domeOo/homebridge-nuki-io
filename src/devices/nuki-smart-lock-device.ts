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
import { NukiSmartLockConfig } from "./nuki-smart-lock-config";


export class NukiSmartLockDevice extends AbstractNukIDevice {

    static BATTERY_LEVEL = 50;

    static RESET_STATE_TIMEOUT = 1500;

    static UNLATCH_NAME = 'Unlatch Door';

    static LOCK_NAME = 'Lock Door';

    static DOOR_OPEN_SENSOR_NAME = 'Contact Sensor';

    private readonly _config: NukiSmartLockConfig;

    private readonly _batteryService: Service;

    private _contactSensorService: Service | undefined;

    private readonly _unlatchService: Service;

    private readonly _lockService: Service;

    private _resetUnlatchTimeout: NodeJS.Timeout | undefined;

    constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, accessory: PlatformAccessory, config: NukiSmartLockConfig) {
        super(api, log, nukiApi, NukiDeviceTypes.SmartLock, accessory);

        this._config = config;

        this._batteryService = this.getOrAddService(api.hap.Service.BatteryService);
        this._batteryService.updateCharacteristic(api.hap.Characteristic.BatteryLevel, NukiSmartLockDevice.BATTERY_LEVEL);
        this._batteryService.updateCharacteristic(
            api.hap.Characteristic.ChargingState,
            api.hap.Characteristic.ChargingState.NOT_CHARGEABLE,
        );

        this._contactSensorService = this._accessory.getService(api.hap.Service.ContactSensor);

        this._unlatchService = this.getOrAddService(api.hap.Service.LockMechanism, NukiSmartLockDevice.UNLATCH_NAME);
        this._unlatchService.getCharacteristic(api.hap.Characteristic.LockTargetState)
            .on('set', this.handleUnlatchTargetStateSet.bind(this));

        this._lockService = this.getOrAddService(api.hap.Service.Switch, NukiSmartLockDevice.LOCK_NAME);
        this._lockService.getCharacteristic(api.hap.Characteristic.On)
            .on('set', this.handleLockSwitchSet.bind(this));

        this._informationService
            .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Nuki')
            .setCharacteristic(api.hap.Characteristic.Model, 'SmartLock')
            .setCharacteristic(api.hap.Characteristic.SerialNumber, this.id);

    }

    handleBatteryLevelGet(callback: CharacteristicGetCallback) {
        callback(null, 50);
    }

    handleUnlatchTargetStateSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        const resetUnlatch = () => {
            this._unlatchService.updateCharacteristic(
                this._api.hap.Characteristic.LockCurrentState,
                this._api.hap.Characteristic.LockCurrentState.SECURED,
            );
            this._unlatchService.updateCharacteristic(
                this._api.hap.Characteristic.LockTargetState,
                this._api.hap.Characteristic.LockTargetState.SECURED,
            );
        };

        if (this._resetUnlatchTimeout) {
            clearTimeout(this._resetUnlatchTimeout);
        }

        if (value !== this._api.hap.Characteristic.LockCurrentState.UNSECURED
            || (!this._config.unlatchWhenLocked)) { // TODO: Implement me!
            this._resetUnlatchTimeout = setTimeout(resetUnlatch.bind(this), NukiSmartLockDevice.RESET_STATE_TIMEOUT);
            return callback(null);
        }

        this._nukiApi.lockAction(this.id, NukiDeviceTypes.SmartLock, NukiLockAction.UNLATCH).then(() => {
            this._unlatchService.updateCharacteristic(
                this._api.hap.Characteristic.LockCurrentState,
                this._api.hap.Characteristic.LockCurrentState.UNSECURED,
            );
            this._resetUnlatchTimeout = setTimeout(resetUnlatch.bind(this), NukiSmartLockDevice.RESET_STATE_TIMEOUT);
        }).catch((err) => {
            this._log.error(err);
            resetUnlatch();
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

    update(lastKnownState: NukiDeviceState) {
        this._log.debug('lastKnownState Lock', lastKnownState);

        // Update Lock.
        if (this._lockService.getServiceId() === this._api.hap.Service.Switch.UUID) {
            this._lockService.updateCharacteristic(this._api.hap.Characteristic.On, lastKnownState.state === NukiLockState.LOCKED);

        } else if (this._lockService.getServiceId() === this._api.hap.Service.LockMechanism.UUID) {
            let lockCurrentState = this._unlatchService.getCharacteristic(this._api.hap.Characteristic.LockCurrentState).value;
            let lockTargetState = this._unlatchService.getCharacteristic(this._api.hap.Characteristic.LockTargetState).value;

            switch (lastKnownState.state) {
                case NukiLockState.LOCKED:
                    lockCurrentState = this._api.hap.Characteristic.LockCurrentState.SECURED;
                    lockTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                    break;

                case NukiLockState.LOCKING:
                    lockCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                    lockTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                    break;

                case NukiLockState.MOTOR_BLOCKED:
                    lockCurrentState = this._api.hap.Characteristic.LockCurrentState.JAMMED;
                    break;

                case NukiLockState.UNCALIBRATED:
                    lockCurrentState = this._api.hap.Characteristic.LockCurrentState.JAMMED;
                    break;

                case NukiLockState.UNDEFINED:
                    lockCurrentState = this._api.hap.Characteristic.LockCurrentState.UNKNOWN;
                    lockTargetState = this._api.hap.Characteristic.LockCurrentState.UNKNOWN;
                    break;

                case NukiLockState.UNLATCHED:
                    lockCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                    lockTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                    break;

                case NukiLockState.UNLATCHING:
                    lockTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                    break;

                case NukiLockState.UNLOCKED:
                    lockCurrentState = this._api.hap.Characteristic.LockCurrentState.UNSECURED;
                    lockTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                    break;

                case NukiLockState.UNLOCKED_LOCK_AND_GO:
                    lockTargetState = this._api.hap.Characteristic.LockTargetState.SECURED;
                    break;

                case NukiLockState.UNLOCKING:
                    lockTargetState = this._api.hap.Characteristic.LockTargetState.UNSECURED;
                    break;
            }

            this._lockService.updateCharacteristic(
                this._api.hap.Characteristic.LockCurrentState,
                lockCurrentState as CharacteristicValue,
            );
            this._lockService.updateCharacteristic(
                this._api.hap.Characteristic.LockTargetState,
                lockTargetState as CharacteristicValue,
            );
        }

        // Update Unlatch Lock.
        if (lastKnownState.state === NukiLockState.UNLATCHING
            || lastKnownState.state === NukiLockState.UNLATCHED) {
            this._unlatchService.updateCharacteristic(
                this._api.hap.Characteristic.LockCurrentState,
                this._api.hap.Characteristic.LockCurrentState.UNSECURED,
            );
            this._unlatchService.updateCharacteristic(
                this._api.hap.Characteristic.LockTargetState,
                this._api.hap.Characteristic.LockTargetState.UNSECURED,
            );
        } else {
            this._unlatchService.updateCharacteristic(
                this._api.hap.Characteristic.LockCurrentState,
                this._api.hap.Characteristic.LockCurrentState.SECURED,
            );
            this._unlatchService.updateCharacteristic(
                this._api.hap.Characteristic.LockTargetState,
                this._api.hap.Characteristic.LockTargetState.SECURED,
            );
        }

        // Update Battery.
        if (lastKnownState.batteryCritical) {
            this._batteryService.updateCharacteristic(
                this._api.hap.Characteristic.StatusLowBattery,
                this._api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW,
            );
        } else {
            this._batteryService.updateCharacteristic(
                this._api.hap.Characteristic.StatusLowBattery,
                this._api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
            );
        }

        // Update Door Sensor.
        if (lastKnownState.doorsensorState === NukiDoorSensorState.DEACTIVATED) {
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
                this._contactSensorService.getCharacteristic(this._api.hap.Characteristic.ContactSensorState);
            }

            const isFault = lastKnownState.doorsensorState === NukiDoorSensorState.CALIBRATING
                || lastKnownState.doorsensorState === NukiDoorSensorState.DOOR_STATE_UNKNOWN;

            if (isFault) {
                this._contactSensorService.updateCharacteristic(
                    this._api.hap.Characteristic.StatusFault,
                    this._api.hap.Characteristic.StatusFault.GENERAL_FAULT,
                );
            } else {
                let contactSensorState;
                if (lastKnownState.doorsensorState === NukiDoorSensorState.DOOR_OPENED) {
                    contactSensorState = this._api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
                } else {
                    contactSensorState = this._api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
                }
                this._contactSensorService.updateCharacteristic(
                    this._api.hap.Characteristic.ContactSensorState,
                    contactSensorState,
                );
                this._contactSensorService.updateCharacteristic(
                    this._api.hap.Characteristic.StatusFault,
                    this._api.hap.Characteristic.StatusFault.NO_FAULT,
                );
            }
        }

    }
}

