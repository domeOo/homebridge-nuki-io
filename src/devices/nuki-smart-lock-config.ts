export interface NukiSmartLockConfig {
    id: string;
    unsecureLockService: boolean;
    unlatchWhenLocked: boolean;
    secureLockService: boolean;
}

export const NUKI_SMART_LOCK_DEFAULT_CONFIG: NukiSmartLockConfig = {
    id: '',
    unsecureLockService: false,
    unlatchWhenLocked: false,
    secureLockService: true,
};
