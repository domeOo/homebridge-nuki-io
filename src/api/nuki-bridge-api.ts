import bent from 'bent';
import { NukiDeviceTypes } from './nuki-device-types';
import { NukiLockAction } from './nuki-lock-action';
import * as crypto from 'crypto';
import { NukiOpenerAction } from "./nuki-opener-action";

const getJSON = bent('json');

export class NukiBridgeApi {

    private readonly _ip: string;
    private readonly _port: number;
    private readonly _token: string;
    private readonly _hashToken: boolean;

    constructor(id: number, ip: string, port: number, token: string, hashToken: boolean) {
        this._id = id;
        this._ip = ip;
        this._port = port;
        this._token = token;
        this._hashToken = hashToken;
    }

    private _id: number;

    get id(): number {
        return this._id;
    }

    get ip(): string {
        return this._ip;
    }

    get port(): number {
        return this._port;
    }

    get token(): string {
        return this._token;
    }

    static fromJSON(json: any, hashToken: boolean): NukiBridgeApi {
        return new NukiBridgeApi(json.id, json.ip, json.port, json.token, hashToken);
    }

    async info() {
        const info = await getJSON(this.getUrl(['info']));
        this._id = info.ids.serverId;

        return info;
    }

    async list() {
        return await getJSON(this.getUrl(['list']));
    }

    async getCallbacks(): Promise<any[]> {
        const response = await getJSON(this.getUrl(['callback', 'list']));
        return response.callbacks;
    }

    async addCallback(url: string) {
        const response = await getJSON(`http://${this._ip}:${this._port}/callback/add?url=${encodeURIComponent(url)}&token=${this._token}`);
        if (!response.success) {
            throw new Error('callback not added');
        }
    }

    async lockAction(nukiId: string, deviceType: NukiDeviceTypes, action: NukiLockAction | NukiOpenerAction) {
        const url = this.getUrl(['lockAction'],
            new Map([
                ['nukiId', nukiId],
                ['deviceType', deviceType.toString()],
                ['action', action.toString()],
                ['noWait', '0'],
            ]),
        );

        const response = await getJSON(url);
        if (!response.success) {
            throw new Error('lock action failed');
        }
    }

    toString(): string {
        return `id=${this._id} ip=${this._ip} port=${this._port}`;
    }

    toJSON(): any {
        return {
            id: this._id,
            ip: this._ip,
            port: this._port,
            token: this._token,
        };
    }

    private getUrl(path: string[], query?: Map<string, string>) {
        let url = `http://${this._ip}:${this._port}/${path.join('/')}?token=${this._token}`;

        if (this._hashToken) {
            const dateString = new Date().toISOString();
            const randomBytes = crypto.randomBytes(2);
            const randomUInt16 = randomBytes[0] | (randomBytes[0] << 8);
            const hashedToken = crypto
                .createHash('sha256')
                .update(`${dateString},${randomUInt16.toString()},${this._token}`, 'utf8')
                .digest()
                .toString('hex');

            url = `http://${this._ip}:${this._port}/${path.join('/')}?ts=${dateString}&rnr=${randomUInt16}&hash=${hashedToken}`;
        }

        if (query) {
            for (const [key, value] of query) {
                url += `&${key}=${encodeURIComponent(value)}`;
            }
        }

        return url;
    }
}
