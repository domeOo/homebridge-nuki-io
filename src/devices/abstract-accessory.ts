import { API, Logging, PlatformAccessory, Service } from 'homebridge';

export abstract class AbstractAccessory {

    protected readonly _api: API;

    protected readonly _log: Logging;

    protected readonly _id: string;

    protected readonly _uuid: string;

    protected readonly _name: string;

    protected readonly _accessory: PlatformAccessory;

    protected readonly _informationService: Service;

    protected constructor(api: API, log: Logging, accessory: PlatformAccessory) {
        this._api = api;
        this._log = log;

        this._accessory = accessory;
        this._id = this.accessory.context.id;
        this._name = this.accessory.displayName;
        this._uuid = this.accessory.UUID;

        this._informationService = this._accessory.getService(api.hap.Service.AccessoryInformation) as Service;
    }

    protected getOrAddService(givenService: typeof Service, displayName?: string, subtype?: string): Service {
        let service: Service | undefined;
        if (subtype) {
            service = this._accessory.getServiceById(givenService as never, subtype);
        } else {
            service = this._accessory.getService(givenService as never);
        }

        if (!service) {
            service = this._accessory.addService(givenService, displayName, subtype);
        }

        return service;
    }

    get id(): string {
        return this._id;
    }

    get uuid(): string {
        return this._uuid;
    }

    get name(): string {
        return this._name;
    }

    get accessory(): PlatformAccessory {
        return this._accessory;
    }

    public toString(): string {
        return `name=${this.name} id=${this.id} uuid=${this.uuid}`;
    }
}
