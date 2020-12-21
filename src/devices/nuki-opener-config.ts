export interface NukiOpenerConfig {
    id: string;
    name: string;
    rtoSwitchService: boolean;
    continuousModeSwitchService: boolean;
    doorbellService: boolean;
    doorbellMuteService: boolean;
    webApiToken: string
}

export const NUKI_OPENER_DEFAULT_CONFIG: NukiOpenerConfig = {
    id: '',
    name: 'opener',
    rtoSwitchService: false,
    continuousModeSwitchService: false,
    doorbellService: false,
    doorbellMuteService: false,
    webApiToken: ''
};
