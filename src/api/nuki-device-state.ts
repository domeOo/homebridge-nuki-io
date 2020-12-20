import { NukiLockState } from './nuki-lock-state';
import { NukiDoorSensorState } from './nuki-door-sensor-state';
import { NukiOpenerState } from "./nuki-opener-state";

export interface NukiDeviceState {
    mode: number;
    state: NukiLockState | NukiOpenerState;
    stateName: string;
    batteryCritical: boolean;
    doorsensorState: NukiDoorSensorState;
    doorsensorStateName: string;
    ringactionTimestamp: Date;
    ringactionState: boolean;
}
