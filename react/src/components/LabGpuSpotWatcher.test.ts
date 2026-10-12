/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
import { spotNotifications } from './LabGpuSpotWatcher';
import { describe, expect, it } from 'vitest';

describe('spotNotifications', () => {
  it('announces each taken-back state once', () => {
    expect(spotNotifications({ a: 'running' }, { a: 'parked' })).toEqual([
      { sessionId: 'a', kind: 'parked' },
    ]);
    expect(spotNotifications({ a: 'parked' }, { a: 'parked' })).toEqual([]);
    expect(spotNotifications({ a: 'parked' }, { a: 'oom' })).toEqual([
      { sessionId: 'a', kind: 'oom' },
    ]);
    expect(spotNotifications({}, { a: 'held' })).toEqual([
      { sessionId: 'a', kind: 'held' },
    ]);
  });

  it('announces a return to running only after being taken back', () => {
    expect(spotNotifications({ a: 'parked' }, { a: 'running' })).toEqual([
      { sessionId: 'a', kind: 'resumed' },
    ]);
    expect(spotNotifications({ a: 'idle' }, { a: 'running' })).toEqual([]);
    expect(spotNotifications({}, { a: 'running' })).toEqual([]);
  });

  it('stays quiet for sessions whose state is unknown this time', () => {
    expect(spotNotifications({ a: 'parked' }, {})).toEqual([]);
  });
});
