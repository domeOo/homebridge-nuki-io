import { NukiSmartLockConfig } from './devices/nuki-smart-lock-config';

export interface NukiPlatformConfig {
    bridges?: [
        {
            id: number;
            ip: string;
            port: number;
            token: string;
            hashToken: boolean;
        }
    ];
    smartLocks: NukiSmartLockConfig[];
    callbackServer: {
        ip: string;
        port: number;
    };
    hashToken: boolean;
}
