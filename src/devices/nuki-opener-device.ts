import { AbstractNukIDevice } from "./abstract-nuki-device";
import { API, Logging, PlatformAccessory } from "homebridge";
import { NukiBridgeApi } from "../api/nuki-bridge-api";
import { NukiDeviceTypes } from "../api/nuki-device-types";

export class NukiOpenerDevice extends AbstractNukIDevice {

    constructor(api: API, log: Logging, nukiApi: NukiBridgeApi, accessory: PlatformAccessory) {
        super(api, log, nukiApi, NukiDeviceTypes.Opener, accessory);
    }

    update(lastKnownState: unknown) {
    }
}
