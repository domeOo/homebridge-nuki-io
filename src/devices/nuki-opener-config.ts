export interface NukiOpenerConfig {
    id: string;
    name: string;
    rtoSwitchService: boolean;
    continuousModeSwitchService: boolean;
    doorbellService: boolean;
    openerSoundService: boolean;
    doorbellSoundService: boolean;
    doorbellSoundSettings: Array<boolean>;
    webApiToken: string;
    deactivateRtoAfterFirstRing: boolean;
    deactivateRtoAfterFirstRingTimeout: number;
}

export const NUKI_OPENER_DEFAULT_CONFIG: NukiOpenerConfig = {
    id: '',
    name: 'opener',
    rtoSwitchService: false,
    continuousModeSwitchService: false,
    doorbellService: false,
    openerSoundService: false,
    doorbellSoundService: false,
    doorbellSoundSettings: [true, true, true],
    webApiToken: '',
    deactivateRtoAfterFirstRing: false,
    deactivateRtoAfterFirstRingTimeout: 5,
};
