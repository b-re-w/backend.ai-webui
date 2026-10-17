/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
/**
 * Lab addition: arrange the per-model accelerator slots of the labgpu plugin
 * (`cuda-<model>.shares`, `cuda-<model>-spot.shares`, and their `.device` twins)
 * by server (resource group), each split into reserved and spot. Generic slots
 * such as `cuda.device` are dropped unless the user is using them.
 */
import * as _ from 'lodash-es';

const LAB_SLOT = /^cuda-(.+?)(-spot)?\.(shares|device)$/;

export interface LabAcceleratorSlot {
  key: string;
  title: string;
  displayUnit: string;
  used: number;
  total: number;
}

export interface LabAcceleratorModel {
  key: string; // first slot key of the model, stable for React keys
  title: string;
  displayUnit: string;
  used: number;
  total: number;
}

export interface LabAcceleratorServer {
  name: string; // resource group name, '' for models no group reports
  reserved: LabAcceleratorModel[];
  spot: LabAcceleratorModel[];
}

export interface LabAcceleratorLayout {
  servers: LabAcceleratorServer[];
  others: LabAcceleratorSlot[]; // non-lab slots still in use
}

interface ScalingGroupSlots {
  using?: Record<string, unknown>;
  remaining?: Record<string, unknown>;
}

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param slots accelerator slots visible to the user
 * @param scalingGroups check-presets `scaling_groups`: a model belongs to the
 *   group that has capacity left for it or where the user is using it
 * @param order preferred resource group order (`resourceGroupOrder`)
 */
export function arrangeLabAccelerators(
  slots: LabAcceleratorSlot[],
  scalingGroups: Record<string, ScalingGroupSlots> | null | undefined,
  order: ReadonlyArray<string> = [],
): LabAcceleratorLayout {
  const models = new Map<
    string,
    { model: string; spot: boolean } & LabAcceleratorModel & {
        keys: string[];
      }
  >();
  const others: LabAcceleratorSlot[] = [];
  for (const slot of slots) {
    const match = slot.key.match(LAB_SLOT);
    if (!match) {
      if (slot.used > 0) others.push(slot);
      continue;
    }
    const [, model, spotSuffix, kind] = match;
    const id = `${model}${spotSuffix ?? ''}`;
    const entry = models.get(id);
    if (!entry) {
      models.set(id, {
        model,
        spot: !!spotSuffix,
        key: slot.key,
        keys: [slot.key],
        title: slot.title,
        displayUnit: slot.displayUnit,
        used: slot.used,
        total: slot.total,
      });
      continue;
    }
    // `.shares` and `.device` of one model are the same GPUs in GPU units.
    entry.keys.push(slot.key);
    entry.used += slot.used;
    if (kind === 'shares') {
      entry.title = slot.title;
      entry.displayUnit = slot.displayUnit;
    }
    entry.total = Math.max(entry.total, slot.total);
  }

  const groupNames = _.sortBy(_.keys(scalingGroups ?? {}), [
    (name) => {
      const index = order.indexOf(name);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    },
    (name) => name,
  ]);
  const groupOf = (keys: string[]) =>
    _.find(groupNames, (name) =>
      keys.some(
        (key) =>
          toNumber(scalingGroups?.[name]?.remaining?.[key]) > 0 ||
          toNumber(scalingGroups?.[name]?.using?.[key]) > 0,
      ),
    );

  // A spot slot follows its reserved model, which still reports capacity
  // while nothing is lent.
  const byModel = _.groupBy([...models.values()], (entry) => entry.model);
  const servers = new Map<string, LabAcceleratorServer>();
  for (const name of [...groupNames, '']) {
    servers.set(name, { name, reserved: [], spot: [] });
  }
  for (const entries of _.values(byModel)) {
    const group = groupOf(_.flatMap(entries, (entry) => entry.keys)) ?? '';
    for (const entry of entries) {
      const model: LabAcceleratorModel = _.pick(entry, [
        'key',
        'title',
        'displayUnit',
        'used',
        'total',
      ]);
      servers.get(group)![entry.spot ? 'spot' : 'reserved'].push(model);
    }
  }
  return {
    servers: [...servers.values()]
      .map((server) => ({
        ...server,
        reserved: _.sortBy(server.reserved, 'title'),
        spot: _.sortBy(server.spot, 'title'),
      }))
      .filter((server) => server.reserved.length + server.spot.length > 0),
    others,
  };
}
