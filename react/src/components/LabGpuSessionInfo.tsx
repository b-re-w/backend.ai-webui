/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
/**
 * Lab additions to the session detail screen (backend.ai-plugin SPEC section 5):
 * - host ports of the session's services, from `service_ports` and the main kernel's agent address
 * - whether the session's GPUs are lent to spot jobs (or could be), from the `<key>_lent` /
 *   `<key>_lent_since` / `<key>_lendable` live stats that the labgpu accelerator plugin reports
 * - for a spot session, whether its GPU was taken back, from `<key>_spot_state` / `<key>_spot_since`
 *   (plugin SPEC 2.14)
 */
import { LabGpuSessionInfoFragment$key } from '../__generated__/LabGpuSessionInfoFragment.graphql';
import { Tag, Typography } from 'antd';
import { BAIFlex, useMemoizedJSONParse } from 'backend.ai-ui';
import dayjs from 'dayjs';
import { TFunction } from 'i18next';
import * as _ from 'lodash-es';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { graphql, useFragment } from 'react-relay';

interface ServicePort {
  name: string;
  protocol?: string;
  container_ports: number[];
  host_ports: number[];
}

interface LiveStatValue {
  current?: string;
  capacity?: string;
}

export interface LabGpuLending {
  lent: number;
  total: number;
  since: number | null; // unix seconds of the earliest lend, null when nothing is lent
  lendable: number | null; // GPUs that could take a spot job now, null for plugins that do not say
}

export type LabGpuSpotStateName =
  'running' | 'idle' | 'parked' | 'held' | 'oom';

export interface LabGpuSpotState {
  state: LabGpuSpotStateName;
  since: number | null; // unix seconds it entered the state
}

export interface LabGpuSessionInfo {
  host: string | null;
  ports: ServicePort[];
  lending: LabGpuLending | null; // null: no lending stats (spot not in use, or state unknown)
  spot: LabGpuSpotState | null; // null: not a spot session, or state unknown
}

const LENT_SUFFIX = '_lent';
const SPOT_STATE_SUFFIX = '_spot_state';
// Reported numbers of the spot session states (plugin SPEC 2.14). Powers of two, so the mean of
// two different states (duplicate series right after an agent restart) is never a state.
const SPOT_STATES: Record<number, LabGpuSpotStateName> = {
  1: 'running',
  2: 'idle',
  4: 'parked',
  8: 'held',
  16: 'oom',
};

/** "tcp://168.188.127.233:6001" -> "168.188.127.233" */
export function hostFromAgentAddr(agentAddr?: string | null): string | null {
  if (!agentAddr) return null;
  const match = agentAddr.match(/^(?:[a-z]+:\/\/)?(\[[^\]]+\]|[^:/]+)/i);
  return match ? match[1] : null;
}

/**
 * Combine the `<key>_lent` / `<key>_lent_since` stats of every accelerator key; null when none are
 * reported. The manager sums the series of every agent run inside its time window, so after an
 * agent restart each value arrives multiplied. `<key>_lent_since` always has capacity 1, so its
 * capacity is that multiplier and dividing by it restores the real values (plugin SPEC 1.13).
 */
export function lendingFromLiveStat(
  liveStat: Record<string, LiveStatValue> | null | undefined,
): LabGpuLending | null {
  if (!liveStat) return null;
  const keys = _.keys(liveStat).filter((key) => key.endsWith(LENT_SUFFIX));
  if (keys.length === 0) return null;
  let lent = 0;
  let total = 0;
  let lendable: number | null = null;
  const starts: number[] = [];
  for (const key of keys) {
    const since = liveStat[`${key}_since`]; // "<key>_lent" -> "<key>_lent_since"
    const copies = _.toNumber(since?.capacity) || 1;
    lent += (_.toNumber(liveStat[key]?.current) || 0) / copies;
    total += (_.toNumber(liveStat[key]?.capacity) || 0) / copies;
    const start = (_.toNumber(since?.current) || 0) / copies;
    if (start > 0) starts.push(start);
    const able = liveStat[key.replace(/_lent$/, '_lendable')];
    if (able) {
      lendable = (lendable ?? 0) + (_.toNumber(able.current) || 0) / copies;
    }
  }
  lent = Math.round(lent);
  total = Math.round(total);
  return {
    lent,
    total,
    since: lent > 0 && starts.length > 0 ? _.min(starts)! : null,
    lendable: lendable === null ? null : Math.round(lendable),
  };
}

/**
 * The state of a spot session from `<key>_spot_state` / `<key>_spot_since`; null when not
 * reported. Values are divided by the duplicate count like the lending stats; a result that is
 * not a state means old and new agent runs disagree right after a restart, so it counts as unknown.
 */
export function spotStateFromLiveStat(
  liveStat: Record<string, LiveStatValue> | null | undefined,
): LabGpuSpotState | null {
  if (!liveStat) return null;
  const key = _.find(_.keys(liveStat), (k) => k.endsWith(SPOT_STATE_SUFFIX));
  if (!key) return null;
  const copies = _.toNumber(liveStat[key]?.capacity) || 1;
  const code = (_.toNumber(liveStat[key]?.current) || 0) / copies;
  const state = Number.isInteger(code) ? SPOT_STATES[code] : undefined;
  if (!state) return null;
  const sinceStat = liveStat[key.replace(SPOT_STATE_SUFFIX, '_spot_since')];
  const sinceCopies = _.toNumber(sinceStat?.capacity) || 1;
  const since = (_.toNumber(sinceStat?.current) || 0) / sinceCopies;
  return { state, since: since > 0 ? since : null };
}

export function useLabGpuSessionInfo(
  sessionFrgmt: LabGpuSessionInfoFragment$key | null | undefined,
): LabGpuSessionInfo {
  const session = useFragment(
    graphql`
      fragment LabGpuSessionInfoFragment on ComputeSessionNode {
        service_ports
        kernel_nodes {
          edges {
            node {
              cluster_role
              agent_addr
              live_stat
            }
          }
        }
      }
    `,
    sessionFrgmt,
  );
  const kernels = _.compact(
    _.map(session?.kernel_nodes?.edges, (edge) => edge?.node),
  );
  const mainKernel =
    _.find(kernels, (kernel) => kernel.cluster_role === 'main') ??
    _.first(kernels);
  const ports = useMemoizedJSONParse<ServicePort[]>(session?.service_ports, {
    fallbackValue: [],
  });
  const liveStat = useMemoizedJSONParse<Record<string, LiveStatValue> | null>(
    mainKernel?.live_stat,
    { fallbackValue: null },
  );
  return {
    host: hostFromAgentAddr(mainKernel?.agent_addr),
    ports: _.filter(ports, (port) => !_.isEmpty(port?.host_ports)),
    lending: lendingFromLiveStat(liveStat),
    spot: spotStateFromLiveStat(liveStat),
  };
}

export const LabGpuSessionPorts: React.FC<{ info: LabGpuSessionInfo }> = ({
  info,
}) => {
  return (
    <BAIFlex direction="column" align="start" gap="xxs">
      {info.ports.map((port) =>
        port.host_ports.map((hostPort, index) => {
          const address = `${info.host ?? '?'}:${hostPort}`;
          return (
            <BAIFlex key={`${port.name}-${hostPort}`} gap="xs" wrap="wrap">
              <Tag>{port.name}</Tag>
              <Typography.Text
                copyable={{ text: address }}
                style={{ fontFamily: 'monospace' }}
              >
                {address}
              </Typography.Text>
              <Typography.Text
                type="secondary"
                style={{ fontFamily: 'monospace' }}
              >
                → {port.container_ports[index] ?? port.container_ports[0]}
              </Typography.Text>
            </BAIFlex>
          );
        }),
      )}
    </BAIFlex>
  );
};

function elapsedText(t: TFunction, since: number) {
  const minutes = Math.max(0, dayjs().diff(dayjs.unix(since), 'minute'));
  return t('labgpu.LentFor', {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
    since: dayjs.unix(since).format('lll'),
  });
}

export const LabGpuSessionLending: React.FC<{ lending: LabGpuLending }> = ({
  lending,
}) => {
  const { t } = useTranslation();
  if (lending.lent <= 0 && (lending.lendable ?? 0) > 0) {
    return (
      <BAIFlex gap="xs" wrap="wrap" align="center">
        <Tag color="green">{t('labgpu.Lendable')}</Tag>
        <Typography.Text>
          {t('labgpu.LendableGpus', {
            lendable: lending.lendable,
            total: lending.total,
          })}
        </Typography.Text>
      </BAIFlex>
    );
  }
  if (lending.lent <= 0) {
    return <Tag>{t('labgpu.NotLent')}</Tag>;
  }
  return (
    <BAIFlex gap="xs" wrap="wrap" align="center">
      <Tag color="orange">{t('labgpu.Lent')}</Tag>
      <Typography.Text>
        {t('labgpu.LentGpus', { lent: lending.lent, total: lending.total })}
      </Typography.Text>
      {lending.since !== null && (
        <Typography.Text type="secondary">
          {elapsedText(t, lending.since)}
        </Typography.Text>
      )}
    </BAIFlex>
  );
};

const SPOT_STATE_TAG: Record<
  LabGpuSpotStateName,
  { color?: string; label: string; detail: string }
> = {
  running: { color: 'blue', label: 'SpotRunning', detail: 'SpotRunningDetail' },
  idle: { label: 'SpotIdle', detail: 'SpotIdleDetail' },
  parked: { color: 'orange', label: 'SpotParked', detail: 'SpotParkedDetail' },
  held: { color: 'red', label: 'SpotHeld', detail: 'SpotHeldDetail' },
  oom: { color: 'red', label: 'SpotOom', detail: 'SpotOomDetail' },
};

export const LabGpuSpotStatus: React.FC<{ spot: LabGpuSpotState }> = ({
  spot,
}) => {
  const { t } = useTranslation();
  const tag = SPOT_STATE_TAG[spot.state];
  return (
    <BAIFlex gap="xs" wrap="wrap" align="center">
      <Tag color={tag.color}>{t(`labgpu.${tag.label}`)}</Tag>
      <Typography.Text>{t(`labgpu.${tag.detail}`)}</Typography.Text>
      {spot.since !== null && (
        <Typography.Text type="secondary">
          {elapsedText(t, spot.since)}
        </Typography.Text>
      )}
    </BAIFlex>
  );
};
