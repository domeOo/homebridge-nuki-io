export interface NukiPlatformConfig {
    bridges?: [
        {
            id: number,
            ip: string,
            port: number,
            token: string,
            hashToken: boolean
        }
    ];
    callbackServer: { ip: string, port: number };
    hashToken: boolean;
}
