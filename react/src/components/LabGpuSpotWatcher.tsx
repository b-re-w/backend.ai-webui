/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
/**
 * Lab addition (backend.ai-plugin SPEC section 5): tell the user when one of their spot sessions
 * is taken back for a reserved session, and when it runs again. Polls the user's running sessions'
 * `<key>_spot_state` live stats and raises a WebUI notification (and a desktop notification when
 * the user setting allows it) on each state change.
 */
import { LabGpuSpotWatcherQuery } from '../__generated__/LabGpuSpotWatcherQuery.graphql';
import { useCurrentUserInfo } from '../hooks/backendai';
import { useSetBAINotification } from '../hooks/useBAINotification';
import {
  LabGpuSpotStateName,
  spotStateFromLiveStat,
} from './LabGpuSessionInfo';
import { useInterval } from 'backend.ai-ui';
import * as _ from 'lodash-es';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchQuery, graphql, useRelayEnvironment } from 'react-relay';

const POLL_MS = 30_000;
const STORAGE_KEY = 'labgpu.spot.notified';
const TAKEN_BACK: ReadonlySet<LabGpuSpotStateName> = new Set([
  'parked',
  'oom',
  'held',
]);

export type SpotNotificationKind = 'parked' | 'oom' | 'held' | 'resumed';

export interface SpotNotification {
  sessionId: string;
  kind: SpotNotificationKind;
}

/**
 * Notifications for the change from the last notified states to the current ones. Taken-back
 * states are announced once each; a return to running after one of them is announced as resumed.
 * Sessions with an unknown state are left out of `current` and keep their last notified state.
 */
export function spotNotifications(
  notified: Record<string, LabGpuSpotStateName>,
  current: Record<string, LabGpuSpotStateName>,
): SpotNotification[] {
  const out: SpotNotification[] = [];
  _.forEach(current, (state, sessionId) => {
    const before = notified[sessionId];
    if (state === before) return;
    if (TAKEN_BACK.has(state)) {
      out.push({ sessionId, kind: state as SpotNotificationKind });
    } else if (state === 'running' && before && TAKEN_BACK.has(before)) {
      out.push({ sessionId, kind: 'resumed' });
    }
  });
  return out;
}

function loadNotified(): Record<string, LabGpuSpotStateName> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') ?? {};
  } catch {
    return {};
  }
}

function saveNotified(states: Record<string, LabGpuSpotStateName>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Without storage the watcher only remembers states while this window is open.
  }
}

const NOTIFICATION_TEXT: Record<
  SpotNotificationKind,
  {
    label: string;
    detail: string;
    type: 'warning' | 'error' | 'success';
    duration: number;
  }
> = {
  parked: {
    label: 'SpotParked',
    detail: 'SpotParkedDetail',
    type: 'warning',
    duration: 0,
  },
  oom: {
    label: 'SpotOom',
    detail: 'SpotOomDetail',
    type: 'error',
    duration: 0,
  },
  held: {
    label: 'SpotHeld',
    detail: 'SpotHeldDetail',
    type: 'error',
    duration: 0,
  },
  resumed: {
    label: 'SpotResumed',
    detail: 'SpotResumedDetail',
    type: 'success',
    duration: 10,
  },
};

const LabGpuSpotWatcher: React.FC = () => {
  'use memo';
  const { t } = useTranslation();
  const relayEnv = useRelayEnvironment();
  const [userInfo] = useCurrentUserInfo();
  const { upsertNotification } = useSetBAINotification();
  const notifiedRef = useRef<Record<string, LabGpuSpotStateName> | null>(null);
  const inFlightRef = useRef(false);

  const check = async () => {
    if (!userInfo.uuid || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const data = await fetchQuery<LabGpuSpotWatcherQuery>(
        relayEnv,
        graphql`
          query LabGpuSpotWatcherQuery($scopeId: ScopeField) {
            compute_session_nodes(
              first: 100
              filter: "status == \"RUNNING\""
              scope_id: $scopeId
            ) {
              edges {
                node {
                  row_id
                  name
                  kernel_nodes {
                    edges {
                      node {
                        cluster_role
                        live_stat
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        { scopeId: `user:${userInfo.uuid}` },
        { fetchPolicy: 'network-only' },
      ).toPromise();
      const sessions = _.compact(
        _.map(data?.compute_session_nodes?.edges, (edge) => edge?.node),
      );
      const names: Record<string, string> = {};
      const current: Record<string, LabGpuSpotStateName> = {};
      for (const session of sessions) {
        const kernels = _.compact(
          _.map(session.kernel_nodes?.edges, (edge) => edge?.node),
        );
        const main =
          _.find(kernels, (kernel) => kernel.cluster_role === 'main') ??
          _.first(kernels);
        let liveStat = null;
        try {
          liveStat = main?.live_stat ? JSON.parse(main.live_stat) : null;
        } catch {
          liveStat = null;
        }
        const spot = spotStateFromLiveStat(liveStat);
        if (spot && session.row_id) {
          current[session.row_id] = spot.state;
          names[session.row_id] = session.name ?? session.row_id;
        }
      }
      const notified = notifiedRef.current ?? loadNotified();
      for (const { sessionId, kind } of spotNotifications(notified, current)) {
        const text = NOTIFICATION_TEXT[kind];
        upsertNotification({
          key: `labgpu-spot-${sessionId}`,
          type: text.type,
          title: `${names[sessionId]}: ${t(`labgpu.${text.label}`)}`,
          description: t(`labgpu.${text.detail}`),
          duration: text.duration,
          open: true,
          to: {
            pathname: '/session',
            search: new URLSearchParams({
              sessionDetail: sessionId,
            }).toString(),
          },
          toText: t('labgpu.OpenSession'),
        });
      }
      // Keep the last notified state of every running spot session; forget sessions that ended.
      const running = new Set(_.map(sessions, (session) => session.row_id));
      const next = _.pickBy({ ...notified, ...current }, (_state, sessionId) =>
        running.has(sessionId),
      );
      notifiedRef.current = next;
      saveNotified(next);
    } catch {
      // A failed poll changes nothing; the next one tries again.
    } finally {
      inFlightRef.current = false;
    }
  };

  // Check once on mount; later checks come from the interval.
  const checkOnMount = useEffectEvent(check);
  useEffect(() => {
    checkOnMount();
  }, []);
  // Keep polling while the window is hidden: that is when a notification matters most.
  useInterval(check, POLL_MS, false);

  return null;
};

export default LabGpuSpotWatcher;
