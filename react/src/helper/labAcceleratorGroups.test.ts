import {
  arrangeLabAccelerators,
  pairReservedAndSpot,
} from './labAcceleratorGroups';
import { describe, expect, it } from 'vitest';

const slot = (key: string, title: string, used = 0, total = Infinity) => ({
  key,
  title,
  displayUnit: key,
  used,
  total,
});

const slots = [
  slot('cuda.device', 'GPU'),
  slot('cuda-pro6000.shares', 'PRO 6000'),
  slot('cuda-pro6000-spot.shares', 'PRO 6000 Spot'),
  slot('cuda-pro6000-spot.device', 'PRO 6000 Spot', 1),
  slot('cuda-pro5000.shares', 'PRO 5000', 0.5),
  slot('cuda-pro5000-spot.shares', 'PRO 5000 Spot'),
  slot('cuda-a6000.shares', 'A6000'),
];

const scalingGroups = {
  secondary: { remaining: { 'cuda-pro5000.shares': '1' }, using: {} },
  primary: { remaining: { 'cuda-pro6000.shares': '2' }, using: {} },
  console: { remaining: { 'cuda-a6000.shares': '0' }, using: {} },
};

describe('arrangeLabAccelerators', () => {
  const layout = arrangeLabAccelerators(slots, scalingGroups, [
    'primary',
    'secondary',
    'console',
  ]);

  it('groups models by resource group in the configured order', () => {
    expect(layout.servers.map((s) => s.name)).toEqual([
      'primary',
      'secondary',
      '',
    ]);
  });

  it('splits reserved and spot and merges the device twin', () => {
    const primary = layout.servers[0];
    expect(primary.reserved.map((m) => m.title)).toEqual(['PRO 6000']);
    expect(primary.spot).toEqual([
      expect.objectContaining({ title: 'PRO 6000 Spot', used: 1 }),
    ]);
  });

  it('puts the spot slot with its reserved model', () => {
    expect(layout.servers[1].spot.map((m) => m.title)).toEqual([
      'PRO 5000 Spot',
    ]);
  });

  it('keeps models no group reports in an unnamed group', () => {
    expect(layout.servers[2].reserved.map((m) => m.title)).toEqual(['A6000']);
  });

  it('drops generic slots that are not in use', () => {
    expect(layout.others).toEqual([]);
    const used = arrangeLabAccelerators([slot('cuda.device', 'GPU', 1)], {});
    expect(used.others.map((s) => s.key)).toEqual(['cuda.device']);
  });
});

describe('pairReservedAndSpot', () => {
  it('puts a model and its spot slot on one row', () => {
    const layout = arrangeLabAccelerators(slots, scalingGroups, ['primary']);
    const rows = pairReservedAndSpot(layout.servers[0]);
    expect(rows).toEqual([
      expect.objectContaining({
        model: 'pro6000',
        title: 'PRO 6000',
        reserved: expect.objectContaining({ used: 0 }),
        spot: expect.objectContaining({ used: 1 }),
      }),
    ]);
  });
});
