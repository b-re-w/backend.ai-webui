/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
import {
  hostFromAgentAddr,
  lendingFromLiveStat,
  spotStateFromLiveStat,
} from './LabGpuSessionInfo';
import { describe, expect, it } from 'vitest';

describe('hostFromAgentAddr', () => {
  it('extracts the host from agent RPC addresses', () => {
    expect(hostFromAgentAddr('tcp://168.188.127.233:6001')).toBe(
      '168.188.127.233',
    );
    expect(hostFromAgentAddr('10.0.0.5:6001')).toBe('10.0.0.5');
    expect(hostFromAgentAddr('tcp://gpu-primary:6001')).toBe('gpu-primary');
    expect(hostFromAgentAddr('tcp://[fd00::1]:6001')).toBe('[fd00::1]');
    expect(hostFromAgentAddr(null)).toBeNull();
  });
});

describe('lendingFromLiveStat', () => {
  it('returns null when no lending stats are reported', () => {
    expect(lendingFromLiveStat(null)).toBeNull();
    expect(
      lendingFromLiveStat({ cpu_util: { current: '1', capacity: '100' } }),
    ).toBeNull();
  });

  it('reports lent GPUs and the earliest start', () => {
    expect(
      lendingFromLiveStat({
        pro6000_lent: { current: '1', capacity: '2' },
        pro6000_lent_since: { current: '1790000000', capacity: '1' },
      }),
    ).toEqual({ lent: 1, total: 2, since: 1790000000, lendable: null });
  });

  it('reports not lent with no start time', () => {
    expect(
      lendingFromLiveStat({
        a6000_lent: { current: '0', capacity: '1' },
        a6000_lent_since: { current: '0', capacity: '1' },
      }),
    ).toEqual({ lent: 0, total: 1, since: null, lendable: null });
  });

  it('undoes the manager summing duplicate series after agent restarts', () => {
    // Two agent runs inside the manager's time window: every value arrives doubled.
    expect(
      lendingFromLiveStat({
        pro6000_lent: { current: '2', capacity: '2' },
        pro6000_lent_since: { current: '3580000000', capacity: '2' },
      }),
    ).toEqual({ lent: 1, total: 1, since: 1790000000, lendable: null });
  });

  it('combines several accelerator keys', () => {
    expect(
      lendingFromLiveStat({
        pro6000_lent: { current: '1', capacity: '1' },
        pro6000_lent_since: { current: '1790000500', capacity: '1' },
        a6000_lent: { current: '1', capacity: '1' },
        a6000_lent_since: { current: '1790000100', capacity: '1' },
      }),
    ).toEqual({ lent: 2, total: 2, since: 1790000100, lendable: null });
  });

  it('counts GPUs that could take a spot job', () => {
    expect(
      lendingFromLiveStat({
        pro5000_lent: { current: '0', capacity: '2' },
        pro5000_lent_since: { current: '0', capacity: '1' },
        pro5000_lendable: { current: '2', capacity: '2' },
      }),
    ).toEqual({ lent: 0, total: 2, since: null, lendable: 2 });
    // After an agent restart: doubled like the others.
    expect(
      lendingFromLiveStat({
        pro5000_lent: { current: '0', capacity: '4' },
        pro5000_lent_since: { current: '0', capacity: '2' },
        pro5000_lendable: { current: '2', capacity: '4' },
      }),
    ).toEqual({ lent: 0, total: 2, since: null, lendable: 1 });
  });
});

describe('spotStateFromLiveStat', () => {
  it('returns null for sessions that are not spot sessions', () => {
    expect(spotStateFromLiveStat(null)).toBeNull();
    expect(
      spotStateFromLiveStat({ cpu_util: { current: '1', capacity: '100' } }),
    ).toBeNull();
  });

  it('reads the state and when it began', () => {
    expect(
      spotStateFromLiveStat({
        'cuda-pro5000-spot_spot_state': { current: '4', capacity: '1' },
        'cuda-pro5000-spot_spot_since': {
          current: '1790000000',
          capacity: '1',
        },
      }),
    ).toEqual({ state: 'parked', since: 1790000000 });
    expect(
      spotStateFromLiveStat({
        'cuda-pro5000-spot_spot_state': { current: '2', capacity: '1' },
        'cuda-pro5000-spot_spot_since': { current: '0', capacity: '1' },
      }),
    ).toEqual({ state: 'idle', since: null });
  });

  it('undoes duplicates and treats mixed values as unknown', () => {
    expect(
      spotStateFromLiveStat({
        'cuda-pro5000-spot_spot_state': { current: '2', capacity: '2' },
        'cuda-pro5000-spot_spot_since': {
          current: '3580000000',
          capacity: '2',
        },
      }),
    ).toEqual({ state: 'running', since: 1790000000 });
    // running (1) and parked (4) from two agent runs right after a restart: unknown.
    expect(
      spotStateFromLiveStat({
        'cuda-pro5000-spot_spot_state': { current: '5', capacity: '2' },
      }),
    ).toBeNull();
  });
});
