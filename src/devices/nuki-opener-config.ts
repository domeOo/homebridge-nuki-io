export interface NukiOpenerConfig {
    id: string;
    name: string;
    rtoSwitchService: boolean;
    continuousModeSwitchService: boolean;
    doorbellService: boolean;
    openerSoundService: boolean;
    doorbellSoundService: boolean;
    doorbellSoundSettings: Array<string>;
    webApiToken: string
}

export const NUKI_OPENER_DEFAULT_CONFIG: NukiOpenerConfig = {
    id: '',
    name: 'opener',
    rtoSwitchService: false,
    continuousModeSwitchService: false,
    doorbellService: false,
    openerSoundService: false,
    doorbellSoundService: false,
    doorbellSoundSettings: [],
    webApiToken: ''
};
