/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
import { SessionReclamationStatusCellFragment$key } from '../../__generated__/SessionReclamationStatusCellFragment.graphql';
import { LabGpuStatusTag, useLabGpuSessionInfo } from '../LabGpuSessionInfo';
import { IdleChecks } from './SessionIdleChecks';
import SessionReclamationStatusPopover, {
  getOverallReclamation,
  useReclamationColorMap,
} from './SessionReclamationStatusPopover';
import { Badge, Typography } from 'antd';
import { useMemoizedJSONParse, BAIFlex } from 'backend.ai-ui';
import { graphql, useFragment } from 'react-relay';

interface SessionReclamationStatusCellProps {
  sessionFrgmt: SessionReclamationStatusCellFragment$key | null | undefined;
}

const SessionReclamationStatusCell: React.FC<
  SessionReclamationStatusCellProps
> = ({ sessionFrgmt }) => {
  'use memo';
  const colorMap = useReclamationColorMap();

  const session = useFragment(
    graphql`
      fragment SessionReclamationStatusCellFragment on ComputeSessionNode {
        id
        idle_checks
        ...SessionReclamationStatusPopoverFragment
        ...LabGpuSessionInfoFragment
      }
    `,
    sessionFrgmt,
  );

  const idleChecks: IdleChecks = useMemoizedJSONParse(session?.idle_checks, {
    fallbackValue: {},
  });
  // Lab: lending of a reserved session and the reclaim state of a spot session.
  const labGpu = useLabGpuSessionInfo(session);
  const labTag = <LabGpuStatusTag info={labGpu} />;

  const utilization = idleChecks.utilization;
  const extra = utilization?.extra;
  const resources = extra?.resources;

  const overall =
    utilization && resources
      ? getOverallReclamation(resources, extra.thresholds_check_operator)
      : null;
  const hasLabTag = !!(labGpu.spot || labGpu.lending);

  if (!overall) {
    return hasLabTag ? labTag : <>-</>;
  }

  const { token: badgeColor, label } = colorMap[overall.color];

  return (
    <BAIFlex direction="column" align="start" gap="xxs">
      <BAIFlex gap="xxs" align="center">
        <Badge color={badgeColor} />
        <Typography.Text>{label}</Typography.Text>
        <SessionReclamationStatusPopover sessionFrgmt={session} />
      </BAIFlex>
      {hasLabTag && labTag}
    </BAIFlex>
  );
};

export default SessionReclamationStatusCell;
