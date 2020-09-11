export interface NukiSmartLockConfig {
    id: string;
    unsecureLockService: boolean;
    unlatchWhenLocked: boolean;
}

export const NUKI_SMART_LOCK_DEFAULT_CONFIG: NukiSmartLockConfig = {
    id: '',
    unsecureLockService: true,
    unlatchWhenLocked: false,
};
