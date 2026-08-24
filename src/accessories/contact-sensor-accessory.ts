import { getTydomDataPropValue } from "../api/types.js";
import { CATEGORY } from "../api/device-type.js";
import type { Service } from "homebridge";
import { debug, debugGet, debugGetResult, debugSetUpdate } from "../platform/trace.js";
import { BaseAccessory } from "./base-accessory.js";
import type { AccessoryDeps } from "./base.js";

const AERATION_SERVICE_SUBTYPE = "aeration";
const AERATION_VALUES = ["2", "AERATION", "VENTILATION", "OPEN_HOPPER", "OPENING_HOPPER"];

const isAeration = (value: unknown): boolean => {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : value;
  return normalizedValue === 2 || AERATION_VALUES.includes(normalizedValue as string);
};

const isOpen = (value: unknown): boolean => {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : value;
  return (
    isAeration(value) ||
    normalizedValue === true ||
    normalizedValue === 1 ||
    ["1", "OPEN", "OPENED", "TRUE"].includes(normalizedValue as string)
  );
};

/** A door or window opening contact (Delta Dore MDO). */
export class ContactSensorAccessory extends BaseAccessory {
  readonly #service: Service;
  readonly #aerationService?: Service;

  constructor(deps: AccessoryDeps) {
    super(deps);
    const { ContactSensorState } = this.platform.Characteristic;
    this.#service = this.service(this.platform.Service.ContactSensor);
    if (this.accessory.category === CATEGORY.WINDOW) {
      this.#aerationService = this.subService(
        this.platform.Service.Switch,
        this.t("AERATION", "Ventilation"),
        AERATION_SERVICE_SUBTYPE,
      );
    }

    this.#service.getCharacteristic(ContactSensorState).onGet(async () => {
      debugGet(ContactSensorState, this.#service);
      const data = await this.read();
      const intrusionDetect = getTydomDataPropValue(data, "intrusionDetect");
      debug(
        `[ContactSensor] deviceId=${this.deviceId} endpointId=${this.endpointId} ` +
          `intrusionDetect raw=${JSON.stringify(intrusionDetect)} type=${typeof intrusionDetect} ` +
          `data=${JSON.stringify(data)}`,
      );
      const nextValue = isOpen(intrusionDetect)
        ? ContactSensorState.CONTACT_DETECTED
        : ContactSensorState.CONTACT_NOT_DETECTED;
      debugGetResult(ContactSensorState, this.#service, nextValue);
      return nextValue;
    });

    this.#aerationService?.getCharacteristic(this.platform.Characteristic.On).onGet(async () => {
      const { On } = this.platform.Characteristic;
      debugGet(On, this.#aerationService!);
      const data = await this.read();
      const intrusionDetect = getTydomDataPropValue(data, "intrusionDetect");
      debug(
        `[ContactSensor] deviceId=${this.deviceId} endpointId=${this.endpointId} ` +
          `aeration raw=${JSON.stringify(intrusionDetect)} type=${typeof intrusionDetect} ` +
          `data=${JSON.stringify(data)}`,
      );
      const nextValue = isAeration(intrusionDetect);
      debugGetResult(On, this.#aerationService!, nextValue);
      return nextValue;
    });
  }

  protected override apply(updates: Record<string, unknown>[]): void {
    const { ContactSensorState } = this.platform.Characteristic;
    for (const { name, value } of updates) {
      if (name !== "intrusionDetect") {
        continue;
      }
      debug(
        `[ContactSensor] deviceId=${this.deviceId} endpointId=${this.endpointId} ` +
          `intrusionDetect update raw=${JSON.stringify(value)} type=${typeof value}`,
      );
      const nextValue = isOpen(value)
        ? ContactSensorState.CONTACT_DETECTED
        : ContactSensorState.CONTACT_NOT_DETECTED;
      debugSetUpdate(ContactSensorState, this.#service, nextValue);
      this.#service.updateCharacteristic(ContactSensorState, nextValue);
      if (this.#aerationService) {
        const aeration = isAeration(value);
        debugSetUpdate(this.platform.Characteristic.On, this.#aerationService, aeration);
        this.#aerationService.updateCharacteristic(this.platform.Characteristic.On, aeration);
      }
    }
  }
}

export const createContactSensorAccessory = (deps: AccessoryDeps): ContactSensorAccessory =>
  new ContactSensorAccessory(deps);
