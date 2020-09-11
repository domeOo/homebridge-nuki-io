import { API, APIEvent, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge';
import { AbstractNukiDeviceFactory } from './devices/abstract-nuki-device-factory';
import { AbstractNukIDevice } from './devices/abstract-nuki-device';
import { NukiBridgeManager } from './api/nuki-bridge-manager';
import { NukiBridgeApi } from './api/nuki-bridge-api';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import * as http from 'http';
import * as os from 'os';
import { NukiPlatformConfig } from './nuki-platform-config';


export class NukiPlatform implements DynamicPlatformPlugin {

    private readonly log: Logging;

    private config: NukiPlatformConfig;

    private readonly api: API;

    private readonly nukiBrideManager: NukiBridgeManager;

    private readonly nukiDeviceFactory: AbstractNukiDeviceFactory;

    private accessories: PlatformAccessory[] = [];

    private devices: AbstractNukIDevice[] = [];

    constructor(log: Logging, config: PlatformConfig, api: API) {
        this.log = log;
        this.config = Object.assign(this.getDefaultConfig(), config);
        this.api = api;
        this.nukiBrideManager = new NukiBridgeManager(api.user.storagePath(), this.config.hashToken);
        this.nukiDeviceFactory = new AbstractNukiDeviceFactory(log, api, this.nukiBrideManager, this.config);

        api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
            log.info('current registered devices', this.accessories.length);
            this.initPlatform().then(() => {
                log.info('Nuki platform finished initializing!');
            });
        });
    }

    async initPlatform() {
        this.log.info(JSON.stringify(this.config));
        await this.loadBridges();
        await this.startCallbackServer();
        await this.syncNukiDevices();
    }

    configureAccessory(accessory: PlatformAccessory): void {
        this.accessories.push(accessory);
    }

    async loadBridges() {
        if (this.config.bridges && this.config.bridges.length > 0) {
            this.log.info('using static configuration as bridges are defined.');

            this.nukiBrideManager.deleteAll();
            for (const bridge of this.config.bridges) {
                const brideApi = new NukiBridgeApi(bridge.id, bridge.ip, bridge.port, bridge.token, bridge.hashToken);
                this.nukiBrideManager.persist(brideApi);
            }
        } else {
            await this.nukiBrideManager.load();

            this.log.info('using dynamic configuration by discovery as bridges are not defined.');
            const bridges = await this.nukiBrideManager.discover();

            for (const bridge of bridges) {
                const nukiBridgeApi = this.nukiBrideManager.getById(bridge.bridgeId);
                if (nukiBridgeApi) {
                    try {
                        this.log.info(`bridge ${nukiBridgeApi.toString()} already authenticated.`);
                        continue;
                    } catch (err) {
                        if (err.statusCode === 401) {
                            this.log.info(`bridge ${nukiBridgeApi.toString()} authentication failed! Will ask for new token.`);
                            this.nukiBrideManager.delete(bridge);
                        }
                    }
                }

                try {
                    this.log.info(`authenticating with bride ${bridge.ip} please push the button on the bridge.`);
                    const nukiBridgeApi = await this.nukiBrideManager.auth(bridge.bridgeId, bridge.ip, bridge.port);
                    this.log.info(`authentication successful with bride ${nukiBridgeApi.toString()}.`);
                    this.nukiBrideManager.persist(nukiBridgeApi);
                } catch (err) {
                    this.log.error(err);
                }
            }
        }
    }

    async startCallbackServer() {
        const callbackUrl = `http://${this.config.callbackServer.ip}:${this.config.callbackServer.port}`;
        this.log.info(`callback url is ${callbackUrl}`);
        for (const bridge of this.nukiBrideManager.bridges) {
            this.log.info(`init callbacks on ${bridge.toString()}.`);
            const callbacks = await bridge.getCallbacks();
            if (callbacks.find(_ => _.url === callbackUrl)) {
                this.log.info(`callback for url ${callbackUrl} already exists on bridge ${bridge.toString()}.`);
                continue;
            }
            await bridge.addCallback(callbackUrl);
        }

        const server = http.createServer((request, response) => {
            if (request.method === 'POST') {
                let buffer = '';
                request.on('data', (data) => {
                    buffer += data;
                    if (data.length > 1e6) {
                        request.connection.destroy();
                    }
                });
                request.on('end', () => {
                    const body = JSON.parse(buffer);
                    const device = this.devices.find(_ => _.id === body.nukiId.toString());
                    if (!device) {
                        this.log.warn(`no nuki-device found with id=${body.nukiId}`);
                        return;
                    }

                    device.update(body);
                    response.end();
                });
            }
        });

        for (; ;) {
            try {
                await new Promise(((resolve, reject) => {
                    server.listen(this.config.callbackServer.port, resolve);
                    server.once('error', reject);
                }));
                break;
            } catch (err) {
                this.log.error('could not start callback server', err);
                this.log.info('retry in a few seconds...');
                await new Promise((resolve => setTimeout(resolve, 1000)));
            }
        }

    }

    async syncNukiDevices() {
        let devices: AbstractNukIDevice[] = [];

        for (const accessory of this.accessories) {
            const device = this.nukiDeviceFactory.fromAccessory(accessory);
            if (device) {
                this.devices.push(device);
            }
        }

        for (const bridge of this.nukiBrideManager.bridges) {
            try {
                this.log.info(`getting nuki-devices from ${bridge.toString()}.`);
                const bridgeDevices = await this.getNukiDevicesFromBridge(bridge);
                devices = devices.concat(bridgeDevices);
            } catch (err) {
                this.log.error(err);
            }
        }

        const accessories = devices.map(_ => _.accessory);

        const oldAccessories = this.accessories.filter(_ => !accessories.includes(_));
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, oldAccessories);

        const newAccessories = accessories.filter(_ => !this.accessories.includes(_));
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);

        this.devices = devices;
        this.accessories = accessories;
        this.api.updatePlatformAccessories(this.accessories);
    }

    async getNukiDevicesFromBridge(bridge: NukiBridgeApi): Promise<AbstractNukIDevice[]> {
        const nukiDevices = await bridge.list();
        const devices: AbstractNukIDevice[] = [];

        for (const nukiDevice of nukiDevices) {
            const id = nukiDevice.nukiId.toString();

            let device = this.devices.find(_ => _.id === id);
            if (device) {
                this.log.info('found existing nuki-device', device.toString());
            } else {
                device = this.nukiDeviceFactory.fromDeviceType(id, nukiDevice.name, nukiDevice.deviceType, bridge.id as number);
                if (device) {
                    this.log.info('adding new nuki-device', device.toString());
                }
            }

            if (device) {
                device.update(nukiDevice.lastKnownState);
                devices.push(device);
            } else {
                this.log.info('unsupported nuki-device', nukiDevice);
            }
        }

        return devices;
    }

    getIpAddress(): string {
        const interfaces = os.networkInterfaces();
        for (const devName in interfaces) {
            const iface = interfaces[devName] as any;

            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    return alias.address;
                }
            }
        }

        return '0.0.0.0';
    }

    private getDefaultConfig(): NukiPlatformConfig {
        return {
            callbackServer: {
                ip: this.getIpAddress(),
                port: 8890,
            },
            smartLocks: [],
            hashToken: true,
        };
    }
}
