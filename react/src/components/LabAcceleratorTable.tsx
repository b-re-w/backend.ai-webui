/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
/**
 * Lab addition: the labgpu accelerator slots as a compact table, one row per GPU model with its
 * Reserved and Spot amounts side by side, optionally grouped by server (resource group).
 * `LabResourceStatistics` is a drop-in for ResourceStatistics that keeps CPU and memory as they
 * are and shows the labgpu slots in this table.
 */
import {
  LabAcceleratorModel,
  LabAcceleratorRow,
  arrangeLabAccelerators,
  pairReservedAndSpot,
} from '../helper/labAcceleratorGroups';
import { theme, Typography } from 'antd';
import { BAIFlex, ResourceStatistics } from 'backend.ai-ui';
import * as _ from 'lodash-es';
import React from 'react';

type Amount = { current: number; total?: number };
type DisplayType = 'used' | 'free';

export interface LabTableServer {
  name: string; // '' when not grouped by server
  rows: LabAcceleratorRow[];
}

const formatAmount = (value: number) =>
  Number.isFinite(value) ? String(_.round(value, 2)) : '-';

const AmountCell: React.FC<{ model: LabAcceleratorModel | null }> = ({
  model,
}) => {
  const { token } = theme.useToken();
  if (!model) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }
  return (
    <span>
      <Typography.Text strong>{formatAmount(model.used)}</Typography.Text>
      {Number.isFinite(model.total) && model.total > 0 && (
        <Typography.Text
          type="secondary"
          style={{ fontSize: token.fontSizeSM, marginLeft: 2 }}
        >
          / {formatAmount(model.total)}
        </Typography.Text>
      )}
    </span>
  );
};

/** A row is shown when the group has that model at all (some capacity or some use). */
const present = (row: LabAcceleratorRow) =>
  _.some([row.reserved, row.spot], (m) => m && (m.used > 0 || m.total > 0));

export const LabAcceleratorTable: React.FC<{
  servers: LabTableServer[];
  otherServersLabel?: string;
}> = ({ servers, otherServersLabel }) => {
  'use memo';
  const { token } = theme.useToken();
  const grouped = _.some(servers, (s) => s.name !== '');
  const visible = _.filter(
    _.map(servers, (s) => ({ ...s, rows: _.filter(s.rows, present) })),
    (s) => s.rows.length > 0,
  );
  if (visible.length === 0) return null;
  const head: React.CSSProperties = {
    color: token.colorTextSecondary,
    fontWeight: 'normal',
    textAlign: 'left',
    padding: `0 ${token.paddingSM}px ${token.paddingXXS}px 0`,
  };
  const cell: React.CSSProperties = {
    padding: `${token.paddingXXS}px ${token.paddingSM}px ${token.paddingXXS}px 0`,
    verticalAlign: 'top',
  };
  return (
    <div
      style={{
        backgroundColor: token.colorBgLayout,
        borderRadius: token.borderRadiusLG,
        padding: token.paddingSM,
        overflowX: 'auto',
      }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {grouped && <th style={head} />}
            <th style={head} />
            <th style={head}>Reserved</th>
            <th style={head}>Spot</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((server, serverIndex) =>
            server.rows.map((row, index) => (
              <tr
                key={`${server.name}-${row.model}`}
                style={
                  serverIndex > 0 && index === 0
                    ? { borderTop: `1px solid ${token.colorBorderSecondary}` }
                    : undefined
                }
              >
                {grouped && (
                  <td style={cell}>
                    {index === 0 && (
                      <Typography.Text strong>
                        {server.name
                          ? _.upperFirst(server.name)
                          : otherServersLabel}
                      </Typography.Text>
                    )}
                  </td>
                )}
                <td style={cell}>
                  <Typography.Text>{row.title}</Typography.Text>
                </td>
                <td style={cell}>
                  <AmountCell model={row.reserved} />
                </td>
                <td style={cell}>
                  <AmountCell model={row.spot} />
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
};

interface ResourceDataLike {
  cpu: unknown;
  memory: unknown;
  accelerators: Array<
    {
      key: string;
      metadata: { title: string; displayUnit: string };
    } & Record<DisplayType, Amount>
  >;
}

/** ResourceStatistics with the labgpu slots of one resource group shown as a table. */
export const LabResourceStatistics: React.FC<
  Omit<
    React.ComponentProps<typeof ResourceStatistics>,
    'resourceData' | 'displayType'
  > & {
    resourceData: ResourceDataLike;
    displayType: DisplayType;
  }
> = ({ resourceData, displayType, ...props }) => {
  'use memo';
  const layout = arrangeLabAccelerators(
    _.map(resourceData.accelerators, (acc) => ({
      key: acc.key,
      title: acc.metadata.title,
      displayUnit: acc.metadata.displayUnit,
      used: acc[displayType].current,
      total: acc[displayType].total ?? Number.POSITIVE_INFINITY,
    })),
    null,
  );
  const otherKeys = new Set(_.map(layout.others, 'key'));
  return (
    <BAIFlex direction="column" align="stretch" gap="sm">
      <ResourceStatistics
        {...props}
        displayType={displayType}
        resourceData={{
          ...(resourceData as React.ComponentProps<
            typeof ResourceStatistics
          >['resourceData']),
          accelerators: _.filter(resourceData.accelerators, (acc) =>
            otherKeys.has(acc.key),
          ) as React.ComponentProps<
            typeof ResourceStatistics
          >['resourceData']['accelerators'],
        }}
      />
      <LabAcceleratorTable
        servers={_.map(layout.servers, (server) => ({
          name: '',
          rows: pairReservedAndSpot(server),
        }))}
      />
    </BAIFlex>
  );
};
