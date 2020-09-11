import { NukiLockState } from './nuki-lock-state';
import { NukiDoorSensorState } from './nuki-door-sensor-state';

export interface NukiDeviceState {
    mode: number;
    state: NukiLockState;
    stateName: string;
    batteryCritical: boolean;
    doorsensorState: NukiDoorSensorState;
    doorsensorStateName: string;
}
