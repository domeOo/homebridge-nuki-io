export interface NukiPlatformConfig {
    bridges?: [{ id: number, ip: string, port: number, token: string, useHashedToken: boolean }],
    callbackServer: { ip: string, port: number }
}
