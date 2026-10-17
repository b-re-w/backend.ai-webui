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
import { theme, Tooltip, Typography } from 'antd';
import { BAIFlex, ResourceStatistics } from 'backend.ai-ui';
import * as _ from 'lodash-es';
import React from 'react';

type Amount = { current: number; total?: number };
type DisplayType = 'used' | 'free';

export interface LabTableServer {
  name: string; // '' when not grouped by server
  rows: LabAcceleratorRow[];
}

/** Same number format as BAIStatistic (precision 2, trailing zeros dropped). */
const format = (value: number) =>
  Number.isFinite(value) ? String(parseFloat(value.toFixed(2))) : '\u221e';

/** A row is shown when the group has that model at all (some capacity or some use). */
const present = (row: LabAcceleratorRow) =>
  _.some([row.reserved, row.spot], (m) => m && (m.used > 0 || m.total > 0));

/**
 * The vertical divider of BAIRowWrapWithDividers, copied as is: a 1px line overlaid in the
 * middle of the column gap, full item height, no layout impact.
 */
const ColumnDivider: React.FC<{ color: string; gap: number }> = ({
  color,
  gap,
}) => (
  <span
    aria-hidden
    style={{
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: -gap / 2,
      width: 1,
      background: color,
      pointerEvents: 'none',
    }}
  />
);

/**
 * GPU names once per server as column headers (server name on the same line), then a Reserved
 * line and a Spot line of amounts. Typography, sizes, colors, divider and gap are those of the
 * stock accelerator row (ResourceStatistics + BAIStatistic + BAIRowWrapWithDividers).
 */
export const LabAcceleratorTable: React.FC<{
  servers: LabTableServer[];
  otherServersLabel?: string;
  displayType?: DisplayType;
  /** Lab: theme success color for the numbers also in used mode (My Resources on Sessions). */
  accent?: boolean;
}> = ({ servers, otherServersLabel, displayType = 'used', accent = false }) => {
  'use memo';
  const { token } = theme.useToken();
  const visible = _.filter(
    _.map(servers, (s) => ({ ...s, rows: _.filter(s.rows, present) })),
    (s) => s.rows.length > 0,
  );
  if (visible.length === 0) return null;
  const grouped = _.some(visible, (s) => s.name !== '');
  // BAIRowWrapWithDividers defaults and the stock accelerator row's divider color.
  const gap = token.marginXXL;
  const dividerColor = token.colorBorder;
  const numberColor =
    accent || displayType === 'free' ? token.colorSuccess : token.colorText;

  // BAIStatistic title: fontSizeLG, 1em line, colorTextSecondary, a small gap below it.
  const header = (text: React.ReactNode) => (
    <Typography.Text
      style={{
        fontSize: token.fontSizeLG,
        lineHeight: '1em',
        height: token.fontSizeLG,
        marginBottom: token.marginXS,
        color: token.colorTextSecondary,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </Typography.Text>
  );
  // One line per amount, as tall as BAIStatistic's 32px number.
  const line = (
    key: string,
    children: React.ReactNode,
    align: 'end' | 'center' = 'end',
  ) => (
    <BAIFlex key={key} align={align} gap="xxs" style={{ height: 32 }}>
      {children}
    </BAIFlex>
  );
  const kinds = ['reserved', 'spot'] as const;

  const blocks = visible.map((server) => {
    const gridRow = 1;
    const cells: React.ReactNode[] = [];
    cells.push(
      <BAIFlex
        key={`${server.name}-lead`}
        direction="column"
        align="start"
        gap="sm"
        style={{ gridRow, gridColumn: 1 }}
      >
        {header(
          grouped
            ? server.name
              ? _.upperFirst(server.name)
              : otherServersLabel
            : '',
        )}
        {kinds.map((kind) =>
          line(
            kind,
            <Typography.Text
              type="secondary"
              style={{ lineHeight: '1em', whiteSpace: 'nowrap' }}
            >
              {kind === 'reserved' ? 'Reserved' : 'Spot'}
            </Typography.Text>,
            'center', // in the middle of the 32px amount line
          ),
        )}
      </BAIFlex>,
    );
    server.rows.forEach((r, i) => {
      cells.push(
        <div
          key={`${server.name}-${r.model}`}
          style={{ gridRow, gridColumn: 2 + i, position: 'relative' }}
        >
          <BAIFlex direction="column" align="center" gap="sm">
            {header(r.title)}
            {kinds.map((kind) => {
              const m = r[kind];
              return line(
                kind,
                m ? (
                  <Tooltip
                    title={`${format(m.used)} / ${format(m.total)} ${m.displayUnit}`}
                  >
                    <BAIFlex align="end" gap="xxs">
                      <Typography.Text
                        style={{
                          fontSize: 32,
                          lineHeight: '1em',
                          color: numberColor,
                        }}
                      >
                        {format(m.used)}
                      </Typography.Text>
                      {Number.isFinite(m.total) && (
                        <Typography.Text type="secondary">
                          / {format(m.total)}
                        </Typography.Text>
                      )}
                    </BAIFlex>
                  </Tooltip>
                ) : null,
              );
            })}
          </BAIFlex>
          {i < server.rows.length - 1 && (
            <ColumnDivider color={dividerColor} gap={gap} />
          )}
        </div>,
      );
    });
    // Each server on its own shaded block (the stock accelerator block), only as wide as its
    // content, so blocks sit side by side and wrap on narrow screens.
    return (
      <div
        key={server.name || '-'}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${1 + server.rows.length}, max-content)`,
          columnGap: gap,
          maxWidth: '100%',
          overflowX: 'auto',
          backgroundColor: token.colorBgLayout,
          borderRadius: token.borderRadiusLG,
          padding: token.padding,
        }}
      >
        {cells}
      </div>
    );
  });

  return (
    <BAIFlex wrap="wrap" align="start" gap="sm">
      {blocks}
    </BAIFlex>
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
        displayType={displayType}
        servers={_.map(layout.servers, (server) => ({
          name: '',
          rows: pairReservedAndSpot(server),
        }))}
      />
    </BAIFlex>
  );
};
