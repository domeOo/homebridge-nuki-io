import bent from 'bent';
import { NukiDeviceTypes } from './nuki-device-types';
import { NukiLockAction } from './nuki-lock-action';

const getJSON = bent('json');

export class NukiBridgeApi {

    private _id: number;

    private readonly _ip: string;

    private readonly _port: number;

    private readonly _token: string;

    constructor(id: number, ip: string, port: number, token: string) {
        this._id = id;
        this._ip = ip;
        this._port = port;
        this._token = token;
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

    async lockAction(nukiId: string, deviceType: NukiDeviceTypes, action: NukiLockAction) {
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

    static fromJSON(json: any): NukiBridgeApi {
        return new NukiBridgeApi(json.id, json.ip, json.port, json.token);
    }

    private getUrl(path: string[], query?: Map<string, string>) {
        let url = `http://${this._ip}:${this._port}/${path.join('/')}?token=${this.token}`;
        if (query) {
            for (const [key, value] of query) {
                url += `&${key}=${encodeURIComponent(value)}`;
            }
        }

        return url;
    }
}
