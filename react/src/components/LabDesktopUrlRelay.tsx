/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
/**
 * Lab addition (backend.ai-plugin SPEC 1.14): opens in the default browser the URLs that programs
 * in the user's sessions (gh auth login, Claude Code) asked to open. The session's xdg-open writes
 * "<nanoseconds> <url>" to /home/work/.labgpu-browser/<key>; this reads it every few seconds with
 * download_single and hands new URLs to the desktop app. Renders nothing; desktop app only.
 */
import { LabDesktopUrlRelaySessionsQuery } from '../__generated__/LabDesktopUrlRelaySessionsQuery.graphql';
import { useSuspendedBackendaiClient } from '../hooks';
import { useCurrentUserInfo } from '../hooks/backendai';
import { useInterval } from 'backend.ai-ui';
import * as _ from 'lodash-es';
import { useRef } from 'react';
import { fetchQuery, graphql, useRelayEnvironment } from 'react-relay';

const POLL_MS = 3_000;
const SESSIONS_EVERY = 10; // refresh the session list every 10 polls (30 s)
const REQUEST_DIR = '.labgpu-browser';
const SLOT = /^(cuda[^.]*)\.(shares|device)$/;

interface LabDesktopOpener {
  openExternal: (target: string) => void;
}

/** The request file key of a session: the first of its GPU slot keys by name, as xdg-open picks. */
export function requestKey(
  occupiedSlots: Record<string, unknown>,
): string | null {
  const keys = _.uniq(
    _.compact(
      _.map(_.keys(occupiedSlots), (slot) => {
        const match = slot.match(SLOT);
        return match && Number(occupiedSlots[slot]) > 0 ? match[1] : null;
      }),
    ),
  ).sort();
  return keys[0] ?? null;
}

/** The URL of a request line written after `sinceMs`, if it is a web or mail link. */
export function parseRequest(text: string, sinceMs: number): string | null {
  const [stamp, url] = text.trim().split(/\s+/, 2);
  if (!stamp || !url || !/^\d+$/.test(stamp)) return null;
  if (Number(stamp.slice(0, -6)) < sinceMs) return null; // nanoseconds -> milliseconds
  return /^(https?:|mailto:)/.test(url) ? url : null;
}

const LabDesktopUrlRelay: React.FC = () => {
  'use memo';
  const relayEnv = useRelayEnvironment();
  const baiClient = useSuspendedBackendaiClient();
  const [userInfo] = useCurrentUserInfo();
  const startedRef = useRef(Date.now());
  const sessionsRef = useRef<Array<{ id: string; key: string }>>([]);
  const seenRef = useRef<Record<string, string>>({});
  // Sessions whose request file could not be read (no GPU plugin mount, created before it):
  // not asked again, so the manager does not log an error for them every poll.
  const missingRef = useRef<Set<string>>(new Set());
  const pollsRef = useRef(0);
  const inFlightRef = useRef(false);

  const opener = (globalThis as { __labDesktop?: Partial<LabDesktopOpener> })
    .__labDesktop;

  const refreshSessions = async () => {
    const data = await fetchQuery<LabDesktopUrlRelaySessionsQuery>(
      relayEnv,
      graphql`
        query LabDesktopUrlRelaySessionsQuery($scopeId: ScopeField) {
          compute_session_nodes(
            first: 100
            filter: "status == \"RUNNING\""
            scope_id: $scopeId
          ) {
            edges {
              node {
                row_id
                occupied_slots
              }
            }
          }
        }
      `,
      { scopeId: `user:${userInfo.uuid}` },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    const next: Array<{ id: string; key: string }> = [];
    for (const edge of data?.compute_session_nodes?.edges ?? []) {
      const node = edge?.node;
      if (!node?.row_id) continue;
      let slots: Record<string, unknown> = {};
      try {
        slots = JSON.parse(node.occupied_slots ?? '{}') ?? {};
      } catch {
        slots = {};
      }
      const key = requestKey(slots);
      if (key) next.push({ id: node.row_id, key });
    }
    sessionsRef.current = next;
    const ids = new Set(_.map(next, 'id'));
    seenRef.current = _.pickBy(seenRef.current, (_line, id) => ids.has(id));
    missingRef.current = new Set(
      _.filter([...missingRef.current], (id) => ids.has(id)),
    );
  };

  const poll = async () => {
    if (!opener?.openExternal || !userInfo.uuid || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (pollsRef.current++ % SESSIONS_EVERY === 0) await refreshSessions();
      await Promise.all(
        _.map(sessionsRef.current, async ({ id, key }) => {
          if (missingRef.current.has(id)) return;
          try {
            const blob = await baiClient.download_single(
              id,
              `${REQUEST_DIR}/${key}`,
            );
            const line = (await blob.text()).trim();
            if (!line || line === seenRef.current[id]) return;
            seenRef.current[id] = line;
            const url = parseRequest(line, startedRef.current);
            if (url) opener.openExternal?.(url);
          } catch {
            missingRef.current.add(id);
          }
        }),
      );
    } catch {
      // A failed poll changes nothing; the next one tries again.
    } finally {
      inFlightRef.current = false;
    }
  };

  useInterval(poll, opener?.openExternal ? POLL_MS : null, false);

  return null;
};

export default LabDesktopUrlRelay;
