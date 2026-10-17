/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
import { arrangeLabAccelerators } from '../helper/labAcceleratorGroups';
import { useSuspendedBackendaiClient } from '../hooks';
import { ResourceSlotName, useResourceSlotsDetails } from '../hooks/backendai';
import { useCurrentProjectValue } from '../hooks/useCurrentProject';
import { useResourceLimitAndRemaining } from '../hooks/useResourceLimitAndRemaining';
import { theme, Typography } from 'antd';
import {
  BAIBoardItemTitle,
  BAIFlex,
  BAIRowWrapWithDividers,
  BAIStatistic,
  BAIFlexProps,
  ResourceStatistics,
  convertToNumber,
  processMemoryValue,
  BAIFetchKeyButton,
  useFetchKey,
} from 'backend.ai-ui';
import * as _ from 'lodash-es';
import { ReactNode, useTransition } from 'react';
import { Trans, useTranslation } from 'react-i18next';

interface MyResourceProps extends BAIFlexProps {
  fetchKey?: string;
  refetching?: boolean;
  extra?: ReactNode;
}

const MyResource: React.FC<MyResourceProps> = ({
  fetchKey,
  refetching,
  extra,
  ...props
}) => {
  'use memo';
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const currentProject = useCurrentProjectValue();

  const [internalFetchKey, updateInternalFetchKey] = useFetchKey();
  const [isPending, startTransition] = useTransition();
  if (!currentProject.name) {
    throw new Error('Project name is required for MyResource');
  }
  const [
    {
      checkPresetInfo,
      resourceLimitsWithoutResourceGroup,
      remainingWithoutResourceGroup,
    },
  ] = useResourceLimitAndRemaining({
    currentProjectName: currentProject.name,
    ignorePerContainerConfig: true,
    fetchKey: `${fetchKey}${internalFetchKey}`,
  });

  const resourceSlotsDetails = useResourceSlotsDetails();
  const baiClient = useSuspendedBackendaiClient();

  const resourceData = (() => {
    // A failed request is a no-data state, not zero usage across every slot.
    if (!checkPresetInfo) {
      return { cpu: null, memory: null, accelerators: [] };
    }

    // Every `keypair_using` read below defaults to 0: the payload omits slots
    // the keypair holds no allocation for, and `convertToNumber` would read
    // that absence as unlimited. Only limits are unlimited when absent.
    const cpuSlot = resourceSlotsDetails?.resourceSlotsInRG?.['cpu'];
    const memSlot = resourceSlotsDetails?.resourceSlotsInRG?.['mem'];

    const cpuData = cpuSlot
      ? {
          used: {
            current: convertToNumber(checkPresetInfo.keypair_using.cpu ?? 0),
            total: convertToNumber(resourceLimitsWithoutResourceGroup.cpu?.max),
          },
          free: {
            current: convertToNumber(remainingWithoutResourceGroup.cpu),
            total: convertToNumber(resourceLimitsWithoutResourceGroup.cpu?.max),
          },
          metadata: {
            title: cpuSlot.human_readable_name,
            displayUnit: cpuSlot.display_unit,
          },
        }
      : null;

    const memoryData = memSlot
      ? {
          used: {
            current: processMemoryValue(
              checkPresetInfo.keypair_using.mem ?? 0,
              memSlot.display_unit,
            ),
            total: processMemoryValue(
              resourceLimitsWithoutResourceGroup.mem?.max,
              memSlot.display_unit,
            ),
          },
          free: {
            current: processMemoryValue(
              remainingWithoutResourceGroup.mem,
              memSlot.display_unit,
            ),
            total: processMemoryValue(
              resourceLimitsWithoutResourceGroup.mem?.max,
              memSlot.display_unit,
            ),
          },
          metadata: {
            title: memSlot.human_readable_name,
            displayUnit: memSlot.display_unit,
          },
        }
      : null;

    const accelerators = _.compact(
      _.map(
        _.omit(resourceSlotsDetails?.resourceSlotsInRG, ['cpu', 'mem']),
        (resourceSlot, key) => {
          if (!resourceSlot) return null;

          return {
            key,
            used: {
              current: convertToNumber(
                checkPresetInfo.keypair_using[key as ResourceSlotName] ?? 0,
              ),
              total: convertToNumber(
                resourceLimitsWithoutResourceGroup.accelerators[key]?.max,
              ),
            },
            free: {
              current: convertToNumber(
                remainingWithoutResourceGroup.accelerators[key],
              ),
              total: convertToNumber(
                resourceLimitsWithoutResourceGroup.accelerators[key]?.max,
              ),
            },
            metadata: {
              title: resourceSlot.human_readable_name,
              displayUnit: resourceSlot.display_unit,
            },
          };
        },
      ),
    );

    return { cpu: cpuData, memory: memoryData, accelerators };
  })();

  // Lab: accelerators by server, each split into reserved and spot.
  const labLayout = arrangeLabAccelerators(
    _.map(resourceData.accelerators, (acc) => ({
      key: acc.key,
      title: acc.metadata.title,
      displayUnit: acc.metadata.displayUnit,
      used: acc.used.current,
      total: acc.used.total,
    })),
    checkPresetInfo?.scaling_groups,
    baiClient?._config?.resourceGroupOrder,
  );
  const renderModels = (
    label: string,
    models: {
      key: string;
      title: string;
      displayUnit: string;
      used: number;
      total: number;
    }[],
  ) =>
    models.length > 0 && (
      <BAIFlex direction="column" align="stretch" gap="xxs">
        <Typography.Text type="secondary">{label}</Typography.Text>
        <BAIRowWrapWithDividers dividerColor={token.colorBorder}>
          {models.map((model) => (
            <BAIStatistic
              key={model.key}
              current={model.used}
              total={model.total}
              title={model.title}
              unit={model.displayUnit}
              progressMode="normal"
              precision={2}
            />
          ))}
        </BAIRowWrapWithDividers>
      </BAIFlex>
    );

  return (
    <BAIFlex
      direction="column"
      align="stretch"
      style={{
        paddingInline: token.paddingXL,
        paddingBottom: token.padding,
        ...props.style,
      }}
      {..._.omit(props, ['style'])}
    >
      <BAIBoardItemTitle
        title={t('webui.menu.MyResources')}
        tooltip={<Trans i18nKey={'webui.menu.MyResourcesDescription'} />}
        extra={
          <BAIFlex gap={'xs'}>
            <BAIFetchKeyButton
              size="small"
              loading={isPending || refetching}
              value=""
              onChange={() => {
                startTransition(() => {
                  updateInternalFetchKey();
                });
              }}
              variant="link"
              color="default"
            />
            {extra}
          </BAIFlex>
        }
      />

      <ResourceStatistics
        resourceData={{
          ...resourceData,
          accelerators: _.filter(resourceData.accelerators, (acc) =>
            _.some(labLayout.others, (other) => other.key === acc.key),
          ),
        }}
        displayType="used"
        progressMode="normal"
      />
      {labLayout.servers.map((server) => (
        <BAIFlex
          key={server.name || '-'}
          direction="column"
          align="stretch"
          gap="sm"
          style={{
            marginTop: token.marginSM,
            backgroundColor: token.colorBgLayout,
            borderRadius: token.borderRadiusLG,
            padding: token.padding,
          }}
        >
          <Typography.Text strong>
            {server.name || t('labgpu.OtherServers')}
          </Typography.Text>
          {renderModels('Reserved', server.reserved)}
          {renderModels('Spot', server.spot)}
        </BAIFlex>
      ))}
    </BAIFlex>
  );
};

export default MyResource;
