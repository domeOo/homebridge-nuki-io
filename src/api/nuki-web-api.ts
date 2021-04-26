import bent from 'bent';
import { NukiDeviceTypes } from './nuki-device-types';

const headers = {
    'Authorization': 'Bearer 1db3cb5fade30a2ec6ce1a8db1efcf68ccfd980390ec88bacdc2c5fc7f7084d5352e1ffcf1edd729',
};
const getJSON = bent('json', headers);
const postJSON = bent('POST', 'json', headers);


export class NukiWebApi {

    private readonly _token: string;

    constructor(token: string) {
        this._token = token;
    }

    get token(): string {
        return this._token;
    }

    static fromJSON(json: any): NukiWebApi {
        return new NukiWebApi( json.token);
    }

    toJSON(): any {
        return {
            token: this._token,

        };
    }

    private getUrl(path: string[], query?: Map<string, string>) {
        let url = `https://api.nuki.io/${path.join('/')}`;

        if (query) {
            for (const [key, value] of query) {
                url += `&${key}=${encodeURIComponent(value)}`;
            }
        }
        return url;
    }

    private calculateWebId(nukiId: string, deviceTyp: NukiDeviceTypes) {
        const nukiIdAsInt = parseInt(nukiId);
        const deviceTypString = deviceTyp.toString();

        let nukiWebId = nukiIdAsInt.toString(16);

        if(nukiWebId.charAt(0) === '0') {
            nukiWebId = nukiWebId.substring(1);
        }
        nukiWebId = deviceTypString.concat(nukiWebId);
        return parseInt(nukiWebId, 16);
    }

    async getDeviceConfig(nukiId: string, deviceType: NukiDeviceTypes) {
        const url = this.getUrl(['smartlock/'+ this.calculateWebId(nukiId, deviceType)]);
        return await getJSON(url);
    }

    async muteOpenerRingSound(nukiId: string, andvancedCondig: JSON) {
        ///smartlock/{smartlockId}/advanced/openerconfig
        const id = 9095747418;
        const url = this.getUrl([`smartlock/${ this.calculateWebId(nukiId,NukiDeviceTypes.Opener)}/advanced/openerconfig`]);
        console.log('url: ' + url);
        console.log( JSON.stringify(andvancedCondig));
        const response = await postJSON(url, JSON.stringify(andvancedCondig));
        return response;
    }

}
