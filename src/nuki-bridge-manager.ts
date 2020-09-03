import { NukiBridgeApi } from './nuki-bridge-api';
import bent from 'bent';
import path from 'path';
import * as fs from "fs";

const getJSON = bent('json');

export class NukiBridgeManager {

    static FILENAME = 'nuki-bridges.json';

    private readonly _storagePath: string;

    private readonly _bridgeFilePath: string;

    private readonly _bridges: NukiBridgeApi[] = [];

    constructor(storagePath: string) {
        this._storagePath = storagePath;
        this._bridgeFilePath = path.join(this._storagePath, NukiBridgeManager.FILENAME);
        if (!fs.existsSync(this._bridgeFilePath)) {
            fs.writeFileSync(this._bridgeFilePath, JSON.stringify(this._bridges));
        }
    }

    load() {
        const bridges = JSON.parse(fs.readFileSync(this._bridgeFilePath).toString());
        for (const bridge of bridges) {
            this._bridges.push(NukiBridgeApi.fromJSON(bridge));
        }
    }

    persist(nukiBridgeApi: NukiBridgeApi) {
        this._bridges.push(nukiBridgeApi);
        fs.writeFileSync(this._bridgeFilePath, JSON.stringify(this._bridges));
    }

    delete(nukiBridgeApi: NukiBridgeApi) {
        const index = this._bridges.indexOf(nukiBridgeApi);
        if (index >= 0) {
            this.bridges.splice(index, 1);
            fs.writeFileSync(this._bridgeFilePath, JSON.stringify(this._bridges));
        }
    }

    deleteAll() {
        this.bridges.length = 0;
        fs.writeFileSync(this._bridgeFilePath, JSON.stringify(this._bridges));
    }

    async discover() {
        const response = await getJSON('https://api.nuki.io/discover/bridges') as any;
        return response.bridges;
    }

    async auth(id: number, ip: string, port: number) {
        const response = await getJSON(`http://${ip}:${port}/auth`) as any;
        if (!response.success) {
            throw new Error('authentication failed');
        }

        return new NukiBridgeApi(id, ip, port, response.token);
    }

    getById(id: number) {
        return this._bridges.find(bridge => bridge.id === id);
    }

    get bridges(): NukiBridgeApi[] {
        return this._bridges;
    }
}
