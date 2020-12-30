import { AbstractNukIDevice } from './abstract-nuki-device';
import { API, CharacteristicSetCallback, CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge';
import { NukiBridgeApi } from '../api/nuki-bridge-api';
import { NukiDeviceTypes } from '../api/nuki-device-types';
import { NukiDeviceState } from '../api/nuki-device-state';
import { NukiOpenerAction } from '../api/nuki-opener-action';
import { NukiOpenerState } from '../api/nuki-opener-state';
import { NukiOpenerMode } from '../api/nuki-opener-mode';
import { NukiOpenerConfig } from './nuki-opener-config';
import { NukiLockState } from "../api/nuki-lock-state";

export class NukiOpenerDevice extends AbstractNukIDevice {


    private readonly _lockService: Service;

    private readonly _doorRingSignalService: Service | undefined;

    private readonly _rtoSwitchService: Service | undefined;

    private readonly _continuousModeSwitchService: Service | undefined;

    private readonly _openerRingSoundSwitchService: Service | undefined;

    private readonly _doorbellSuppressionSwitchService: Service | undefined;

    private readonly _characteristic: any;

    private bellRingOn = false;

    private isOpening = false;

    private isOpen = false;

    private readonly _nukiWebApi;

    private readonly _config: NukiOpenerConfig;

    private readonly _webId: number;

    constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, accessory: PlatformAccessory, config: NukiOpenerConfig) {
        super(api, log, nukiApi, NukiDeviceTypes.Opener, accessory);
        this._config = config;
        const Nuki = require('nuki-web-api');
        this._nukiWebApi = new Nuki(config.webApiToken);
        this._webId = NukiOpenerDevice.calculateWebId(this.id);
        this._characteristic = this._api.hap.Characteristic;

        this._lockService = this.getOrAddService(api.hap.Service.LockMechanism, 'Opener Öffnen');
        this._lockService.getCharacteristic(api.hap.Characteristic.LockTargetState)
            .on('get', this.handleLockSwitchGet.bind(this))
            .on('set', this.handleLockSwitchSet.bind(this));

        this._lockService.getCharacteristic(api.hap.Characteristic.LockCurrentState)
        this._lockService.getCharacteristic(api.hap.Characteristic.LockCurrentState)
            .on('get', this.handleLockCurrentSwitchGet.bind(this))
            .on('set', this.handleLockCurrentSwitchSet.bind(this));


        if (this._config.doorbellService) {
            this._doorRingSignalService = this.getOrAddService(api.hap.Service.ContactSensor, 'Door-Ring Indicator');
        } else {
            if (this._doorRingSignalService) {
                accessory.removeService(this._doorRingSignalService);
            }
        }

        if (this._config.rtoSwitchService) {
            this._rtoSwitchService = this.getOrAddService(api.hap.Service.Switch, 'Ring to Open', 'ringToOpen');
        } else {
            if (this._rtoSwitchService) {
                accessory.removeService(this._rtoSwitchService);
            }
        }

        if (this._config.continuousModeSwitchService) {
            this._continuousModeSwitchService = this.getOrAddService(api.hap.Service.Switch, 'Continuous Mode', 'continuousMode');
        } else {
            if (this._continuousModeSwitchService) {
                accessory.removeService(this._continuousModeSwitchService);
            }
        }

        if (this._config.openerSoundService) {
            this._openerRingSoundSwitchService = this.getOrAddService(api.hap.Service.Switch, 'Opener Sound', 'openerSound');
        } else {
            if (this._openerRingSoundSwitchService) {
                accessory.removeService(this._openerRingSoundSwitchService);
            }
        }

        if (this._config.doorbellSoundService) {
            this._doorbellSuppressionSwitchService = this.getOrAddService(api.hap.Service.Switch, 'Doorbell Sound', 'doorbellSound');
        } else {
            if (this._doorbellSuppressionSwitchService) {
                accessory.removeService(this._doorbellSuppressionSwitchService);
            }
        }

        if (this._doorRingSignalService) {
            this._doorRingSignalService.getCharacteristic(api.hap.Characteristic.ContactSensorState)
                .on('get', this.handleDoorRingGet.bind(this))
                .on('set', this.handleDoorRingSet.bind(this));
        }

        // Subscribes for changes of the RTO mode
        if (this._rtoSwitchService) {
            this._rtoSwitchService.getCharacteristic(
                this._characteristic.On).on('set',
                this.handleRtoSwitchServiceSet.bind(this));
        }


        if (this._continuousModeSwitchService) {
            this._continuousModeSwitchService.getCharacteristic(
                this._characteristic.On).on('set',
                this.handleContinuousModeSwitchServiceSet.bind(this),
            );
        }


        if (this._openerRingSoundSwitchService) {
            this._openerRingSoundSwitchService.getCharacteristic(this._characteristic.On)
                .on('set', this.handleOpenerSoundSwitchServiceSet.bind(this))
                .on('get', this.handleOpenerSoundSwitchServiceGet.bind(this));
        }


        if (this._doorbellSuppressionSwitchService) {
            this._doorbellSuppressionSwitchService.getCharacteristic(this._characteristic.On)
                .on('set', this.handleDoorbellSuppressionSwitchServiceSet.bind(this))
                .on('get', this.handleDoorbellSuppressionSwitchServiceGet.bind(this));
        }

        this._informationService
            .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Nuki')
            .setCharacteristic(api.hap.Characteristic.Model, 'Opener')
            .setCharacteristic(api.hap.Characteristic.SerialNumber, this.id);
    }

    update(lastKnownBridgeState: NukiDeviceState) {

        this._log.debug('lastKnownState opener: ', lastKnownBridgeState);
        // Checks if the state exists, which is not the case if the device is unavailable
        if (!lastKnownBridgeState) {
            return;
        }


        // Sets the lock state

        if (lastKnownBridgeState.state === NukiOpenerState.ONLINE || lastKnownBridgeState.state === NukiOpenerState.RTO_ACTIVE) {
            this._log(this.id + ' - Updating lock state: SECURED/SECURED becuas of rto active or online');
            this._lockService.updateCharacteristic(this._characteristic.LockCurrentState, this._characteristic.LockCurrentState.SECURED);
            this._lockService.updateCharacteristic(this._characteristic.LockTargetState, this._characteristic.LockTargetState.SECURED);
        }

        if (lastKnownBridgeState.state === NukiOpenerState.OPEN) {
            this._log(this.id + ' - Updating lock state: UNSECURED/UNSECURED because of open');
            this._lockService.updateCharacteristic(
                this._characteristic.LockCurrentState,
                this._characteristic.LockCurrentState.UNSECURED,
            );
            this._lockService.updateCharacteristic(
                this._characteristic.LockTargetState,
                this._characteristic.LockTargetState.UNSECURED,
            );
            //todo: here maybe add option to disable rto after first ring?
        }
        if (lastKnownBridgeState.state === NukiOpenerState.OPENING) {
            this._log(this.id + ' - Updating lock state: -/UNSECURED becaus of opening');
            this._lockService.updateCharacteristic(
                this._characteristic.LockTargetState,
                this._characteristic.LockTargetState.UNSECURED,
            );
        }

        // Sets the ring action state //
        if (this._doorRingSignalService && lastKnownBridgeState.ringactionState
            && lastKnownBridgeState.mode !== NukiOpenerMode.CONTINUOUS_MODE) {

            if( lastKnownBridgeState.state === NukiOpenerState.ONLINE){
                this._log.debug('Opener with id: ' + this.id + ' - Updating doorbell: Ring');
                this._doorRingSignalService.setCharacteristic(
                    this._characteristic.ContactSensorState,
                    this._characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
                );
            }
            this.deactivateRTOAfterTimeout();
        }

        // Sets the status for the continuous mode
        if (this._continuousModeSwitchService) {
            this._log.debug(this.id + ' - Updating Continuous Mode: ' + lastKnownBridgeState.mode);
            this._continuousModeSwitchService.updateCharacteristic(
                this._characteristic.On,
                lastKnownBridgeState.mode === 3,
            );
        }

        // Sets the status for RTO
        if (this._rtoSwitchService) {
            if (lastKnownBridgeState.state === NukiOpenerState.ONLINE || lastKnownBridgeState.state === NukiOpenerState.RTO_ACTIVE) {
                this._log.debug(this.id + ' - Updating RTO: ' + lastKnownBridgeState.state);
                this._rtoSwitchService.updateCharacteristic(
                    this._characteristic.On,
                    lastKnownBridgeState.state === NukiOpenerState.RTO_ACTIVE,
                );
            }
        }

        // Sets the status of the battery
        this._log.debug(this.id + ' - Updating critical battery: ' + lastKnownBridgeState.batteryCritical);
        if (lastKnownBridgeState.batteryCritical) {
            this._lockService.updateCharacteristic(
                this._characteristic.StatusLowBattery,
                this._characteristic.StatusLowBattery.BATTERY_LEVEL_LOW,
            );
        } else {
            this._lockService.updateCharacteristic(
                this._characteristic.StatusLowBattery,
                this._characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
            );
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

    handleOpenerSoundSwitchServiceGet(callback: CharacteristicSetCallback) {

        this._nukiWebApi.getSmartlock(this._webId).then((res) => {
            return res.openerAdvancedConfig.soundLevel;

        }).then((res) => {
            console.log('result get: ' + res);
            let result = false;
            if (res === 255) {
                result = true;

            }
            callback(null, result);
        }).catch((e) => {
            console.error('getSmartlock(smartlockId): ' + e.message);
            callback(e, undefined);
        });
    }

    handleOpenerSoundSwitchServiceSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        this._log.debug('Opener Sound on: ' + value);
        if (value) {

            this._nukiWebApi.getSmartlock(this._webId).then((res) => {
                res.openerAdvancedConfig.soundLevel = 255;
                res = res.openerAdvancedConfig;
                return res;
            }).then((res) => {
                console.log('current config before change: ');
                console.log(res);
                this._nukiWebApi.setAdvancedConfig(this._webId, res).then((res) => {

                    callback(null);
                }).then(() => {

                    setTimeout(() => {
                        this._nukiWebApi.getSmartlock(this._webId).then((res) => {
                            this._log.debug('config after change');
                            console.log(res.openerAdvancedConfig);


                        });


                    }, 500);

                }).catch((e) => {
                    console.error('getSmartlock(smartlockId): ' + e.message);
                    callback(e);
                });

            });
        } else {
            this._nukiWebApi.getSmartlock(this._webId).then((res) => {
                res.openerAdvancedConfig.soundLevel = 0;
                res = res.openerAdvancedConfig;
                return res;
            }).then((res) => {
                console.log('result before: ');
                console.log(res);
                this._nukiWebApi.setAdvancedConfig(this._webId, res).then((res) => {
                    callback(null);
                });
            }).catch((e) => {
                console.error('getSmartlock(smartlockId): ' + e.message);
                callback(e);
            });
        }
    }

    handleDoorbellSuppressionSwitchServiceGet(callback: CharacteristicSetCallback) {

        this._nukiWebApi.getSmartlock(this._webId).then((res) => {
            console.log(res);
            return res.openerAdvancedConfig.doorbellSuppression;

        }).then((res) => {
            console.log('result get: ' + res);
            let result = false;
            if (res !== 7) {
                result = true;

            }
            callback(null, result);
        }).catch((e) => {
            console.error('getSmartlock(smartlockId): ' + e.message);
            callback(e, undefined);
        });
    }

    handleDoorbellSuppressionSwitchServiceSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        this._log.debug('Opener Doorbell on: ' + value);
        if (value) {

            this._nukiWebApi.getSmartlock(this._webId).then((res) => {

                let settings = '';
                for (const item of this._config.doorbellSoundSettings) {

                    if (item) {
                        settings = settings.concat('1');
                    } else {
                        settings = settings.concat('0');
                    }
                }


                res.openerAdvancedConfig.doorbellSuppression = parseInt(settings, 2);
                return res.openerAdvancedConfig;
            }).then((res) => {
                console.log('current config before change: ');
                this._nukiWebApi.setAdvancedConfig(this._webId, res).then((res) => {

                    callback(null);
                }).then(() => {

                    setTimeout(() => {
                        this._nukiWebApi.getSmartlock(this._webId).then((res) => {
                            this._log.debug('config after change');
                            console.log(res.openerAdvancedConfig);
                        });
                    }, 500)

                }).catch((e) => {
                    console.error('getSmartlock(smartlockId): ' + e.message);
                    callback(e);
                });

            });
        } else {
            this._nukiWebApi.getSmartlock(this._webId).then((res) => {
                res.openerAdvancedConfig.doorbellSuppression = 7;
                res = res.openerAdvancedConfig;
                return res;
            }).then((res) => {
                console.log('result before: ');
                console.log(res);
                this._nukiWebApi.setAdvancedConfig(this._webId, res).then((res) => {
                    callback(null);
                });
            }).catch((e) => {
                console.error('getSmartlock(smartlockId): ' + e.message);
                callback(e);
            });
        }
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
            this._characteristic.ContactSensorState.CONTACT_DETECTED,
        );
    }

    handleDoorRingSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        if (value === this._characteristic.ContactSensorState.CONTACT_NOT_DETECTED) {
            this._log.debug('DING DONG!');
            this.bellRingOn = true;
            setTimeout(() => {
                if (!this._doorRingSignalService) {
                    return;
                }
                this._doorRingSignalService.setCharacteristic(
                    this._characteristic.ContactSensorState,
                    this._characteristic.ContactSensorState.CONTACT_DETECTED,
                );
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
            this._lockService.updateCharacteristic(
                this._characteristic.LockCurrentState,
                this._characteristic.LockCurrentState.SECURED,
            );
            this._lockService.updateCharacteristic(
                this._characteristic.LockTargetState,
                this._characteristic.LockTargetState.SECURED,
            );
            callback(null);
        } else {
            this._nukiApi.lockAction(this.id, NukiDeviceTypes.Opener, NukiOpenerAction.ELETRIC_STRIKE_ACTUATION).then(() => {
                setTimeout(() => {
                    this._lockService.updateCharacteristic(
                        this._characteristic.LockCurrentState,
                        this._characteristic.LockCurrentState.UNSECURED,
                    );
                    this._lockService.updateCharacteristic(
                        this._characteristic.LockTargetState,
                        this._characteristic.LockTargetState.UNSECURED,
                    );
                }, 500);

                setTimeout(() => {
                    this._lockService.updateCharacteristic(
                        this._characteristic.LockCurrentState,
                        this._characteristic.LockCurrentState.SECURED,
                    );
                    this._lockService.updateCharacteristic(
                        this._characteristic.LockTargetState,
                        this._characteristic.LockTargetState.SECURED,
                    );
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

    private static calculateWebId(nukiId: string): number {
        const nukiIdAsInt = parseInt(nukiId);
        const deviceTypString = NukiDeviceTypes.Opener.toString();
        const nukiWebId = nukiIdAsInt.toString(16);
        return parseInt(deviceTypString.concat(nukiWebId), 16);
    }

    private deactivateRTOAfterTimeout() {
        setTimeout(() => {
            this._nukiApi.lockAction(
                this.id, NukiDeviceTypes.Opener,
                NukiOpenerAction.DEACTIVATE_RTO).then(() => {
                this._log.debug(' Opener - Set RTO off after first Ring ');
            }).catch((err) => {
                this._log.error(err);
            });
        }, this._config.deactivateRtoAfterFirstRingTimeout * 1000);
    }
}