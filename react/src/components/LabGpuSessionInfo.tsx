/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
/**
 * Lab additions to the session detail screen (backend.ai-plugin SPEC section 5):
 * - host ports of the session's services, from `service_ports` and the main kernel's agent address
 * - whether the session's GPUs are lent to spot jobs, from the `<key>_lent` / `<key>_lent_since`
 *   live stats that the labgpu accelerator plugin reports
 */
import { LabGpuSessionInfoFragment$key } from '../__generated__/LabGpuSessionInfoFragment.graphql';
import { Tag, Typography } from 'antd';
import { BAIFlex, useMemoizedJSONParse } from 'backend.ai-ui';
import dayjs from 'dayjs';
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
}

export interface LabGpuSessionInfo {
  host: string | null;
  ports: ServicePort[];
  lending: LabGpuLending | null; // null: no lending stats (spot not in use, or state unknown)
}

const LENT_SUFFIX = '_lent';

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
  const starts: number[] = [];
  for (const key of keys) {
    const since = liveStat[`${key}_since`]; // "<key>_lent" -> "<key>_lent_since"
    const copies = _.toNumber(since?.capacity) || 1;
    lent += (_.toNumber(liveStat[key]?.current) || 0) / copies;
    total += (_.toNumber(liveStat[key]?.capacity) || 0) / copies;
    const start = (_.toNumber(since?.current) || 0) / copies;
    if (start > 0) starts.push(start);
  }
  lent = Math.round(lent);
  total = Math.round(total);
  return {
    lent,
    total,
    since: lent > 0 && starts.length > 0 ? _.min(starts)! : null,
  };
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

export const LabGpuSessionLending: React.FC<{ lending: LabGpuLending }> = ({
  lending,
}) => {
  const { t } = useTranslation();
  if (lending.lent <= 0) {
    return <Tag>{t('labgpu.NotLent')}</Tag>;
  }
  const elapsedMinutes =
    lending.since !== null
      ? Math.max(0, dayjs().diff(dayjs.unix(lending.since), 'minute'))
      : null;
  return (
    <BAIFlex gap="xs" wrap="wrap" align="center">
      <Tag color="orange">{t('labgpu.Lent')}</Tag>
      <Typography.Text>
        {t('labgpu.LentGpus', { lent: lending.lent, total: lending.total })}
      </Typography.Text>
      {elapsedMinutes !== null && lending.since !== null && (
        <Typography.Text type="secondary">
          {t('labgpu.LentFor', {
            hours: Math.floor(elapsedMinutes / 60),
            minutes: elapsedMinutes % 60,
            since: dayjs.unix(lending.since).format('lll'),
          })}
        </Typography.Text>
      )}
    </BAIFlex>
  );
};
