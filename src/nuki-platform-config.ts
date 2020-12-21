import { NukiSmartLockConfig } from './devices/nuki-smart-lock-config';
import { NukiOpenerConfig } from './devices/nuki-opener-config';

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
    openers: NukiOpenerConfig[];
    callbackServer: {
        ip: string;
        port: number;
    };
    hashToken: boolean;
}
