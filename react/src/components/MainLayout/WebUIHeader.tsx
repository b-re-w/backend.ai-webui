/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
import { buildPath, MENU_KEY_TO_SCOPE_FEATURE } from '../../helper/pathBuilder';
import {
  useCurrentDomainValue,
  useSuspendedBackendaiClient,
  useWebUINavigate,
} from '../../hooks';
import { useAccessibleProjects } from '../../hooks/useAccessibleProjects';
import {
  useCurrentProjectValue,
  useSetCurrentProject,
} from '../../hooks/useCurrentProject';
import {
  useCurrentUserProjectRoles,
  useEffectiveAdminRole,
} from '../../hooks/useCurrentUserProjectRoles';
import {
  rewriteProjectNameInPath,
  useActiveProjectName,
  useCurrentMenuKey,
  useSwitchProject,
} from '../../hooks/useRouteScope';
import { useUrlProjectValidity } from '../../hooks/useUrlProjectValidity';
import { useWebUIMenuItems } from '../../hooks/useWebUIMenuItems';
import BAINotificationButton from '../BAINotificationButton';
import LoginSessionExtendButton from '../LoginSessionExtendButton';
import ProjectSelect from '../ProjectSelect';
import ReverseThemeProvider from '../ReverseThemeProvider';
import UserDropdownMenu from '../UserDropdownMenu';
import WEBUIHelpButton from '../WEBUIHelpButton';
import WebUIThemeToggleButton from '../WebUIThemeToggleButton';
import { useSessionStorageState } from 'ahooks';
import { theme, Button, Modal, Typography, Grid, Divider } from 'antd';
import { createStyles } from 'antd-style';
import { BAIFlex, BAIFlexProps } from 'backend.ai-ui';
import * as _ from 'lodash-es';
import { MenuIcon } from 'lucide-react';
import { Suspense, useEffect, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatches } from 'react-router-dom';

const useStyles = createStyles(({ css }) => ({
  webuiHeader: css`
    &,
    & .draggable {
      -webkit-app-region: drag;
    }
    & .non-draggable {
      -webkit-app-region: no-drag;
    }
  `,
}));

// `base` (#rrggbb) seen through a translucent `mask` (rgba(...)), as #rrggbb.
const blendOver = (base: string, mask?: string): string => {
  const m = mask?.match(/rgba?\(([^)]+)\)/);
  const b = base.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m || !b) {
    return base;
  }
  const [mr, mg, mb, ma = 1] = m[1].split(',').map((v) => parseFloat(v));
  const mix = (c: string, mc: number) =>
    Math.round(parseInt(c, 16) * (1 - ma) + mc * ma)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(b[1], mr)}${mix(b[2], mg)}${mix(b[3], mb)}`;
};

export interface WebUIHeaderProps extends BAIFlexProps {
  onClickMenuIcon?: () => void;
}

const WebUIHeader: React.FC<WebUIHeaderProps> = ({ onClickMenuIcon }) => {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const currentDomainName = useCurrentDomainValue();
  const currentProject = useCurrentProjectValue();
  const setCurrentProject = useSetCurrentProject();
  const baiClient = useSuspendedBackendaiClient();
  const gridBreakpoint = Grid.useBreakpoint();
  const webuiNavigate = useWebUINavigate();
  const matches = useMatches();
  const currentMenuKey = useCurrentMenuKey();
  const switchProject = useSwitchProject();
  // When the URL carries an invalid/inaccessible `:projectName`, the atom keeps
  // the last valid project, which would make the header selector look like that
  // project is selected. Detect this and show the selector unselected instead.
  // Checked against the selector's own accessible-project source (FR-3388) so
  // this can never disagree with what the selector renders.
  const activeProjectName = useActiveProjectName();
  const { accessibleProjects } = useAccessibleProjects();
  const accessibleProjectNames = _.compact(
    _.map(accessibleProjects, (project) => project?.name),
  );
  // A router-owned 404 outside any project context (e.g. an invalid scope
  // prefix like `/admi/...`) corresponds to no project at all — show the
  // selector placeholder there too. Scoped 404s under a valid
  // `/project/:projectName/*` URL keep their project context (the param is
  // present), so only the projectless catch-alls blank the selector.
  const deepestHandle = matches[matches.length - 1]?.handle as
    { notFound?: boolean } | undefined;
  const { urlProjectName } = useUrlProjectValidity();
  const isProjectlessNotFound = !!deepestHandle?.notFound && !urlProjectName;
  const isUrlProjectInvalid =
    (!!activeProjectName &&
      !accessibleProjectNames.includes(activeProjectName)) ||
    isProjectlessNotFound;
  const { isSelectedAdminCategoryMenu } = useWebUIMenuItems();
  const effectiveAdminRole = useEffectiveAdminRole();
  const { projectAdminIds } = useCurrentUserProjectRoles();
  // Last visited general page — shared with WebUISider's "go back" button so
  // that exiting admin mode returns the user to where they were last. See
  // WebUISider.tsx (`backendaiwebui.last_visited_general_path`).
  const [goBackPath] = useSessionStorageState<string | undefined>(
    'backendaiwebui.last_visited_general_path',
  );

  const [isPendingProjectChanged, startProjectChangedTransition] =
    useTransition();
  const [optimisticProjectId, setOptimisticProjectId] = useState(
    currentProject.id,
  );
  // Tracks whether the admin-exit confirm modal is currently open. While open,
  // the select optimistically shows the target project and a loading state,
  // even though we haven't committed the change yet.
  const [isConfirmingProjectSwitch, setIsConfirmingProjectSwitch] =
    useState(false);
  const isProjectChanging =
    isPendingProjectChanged || isConfirmingProjectSwitch;

  const [modal, modalContextHolder] = Modal.useModal();

  const applyProjectChange = (projectInfo: {
    projectId: string;
    projectName: string;
    projectResourcePolicy: unknown;
  }) => {
    setOptimisticProjectId(projectInfo.projectId);

    // `useSwitchProject` holds the canonical scope rule (FR-3428): on project
    // / project-admin scope the URL owns the current project, so it stays on
    // the exact same page and swaps ONLY the `:projectName` segment, letting
    // `ProjectScopeLayout` converge `currentProjectAtom` to the new URL. On
    // global admin scope it updates the atom directly.
    startProjectChangedTransition(() => {
      switchProject(projectInfo);
    });
  };

  const { styles } = useStyles();

  // Desktop app on Windows/Linux: the native window buttons are drawn over the
  // right end of this header. Their background stays transparent so the page
  // (header, or a drawer/modal mask over it) shows through; the symbols use the
  // header text color, dimmed like the header while a modal mask covers the
  // page (side drawers keep the header clear, see MainLayout).
  const headerFg = token.colorBgBase;
  const maskColor = token.colorBgMask;
  useEffect(() => {
    const overlay = globalThis.__titleBarOverlay;
    if (!overlay || !headerFg) {
      return;
    }
    let last = '';
    const update = () => {
      const masked = _.some(
        document.querySelectorAll('.ant-modal-mask'),
        (el) => (el as HTMLElement).offsetParent !== null,
      );
      const symbolColor = masked ? blendOver(headerFg, maskColor) : headerFg;
      if (symbolColor !== last) {
        last = symbolColor;
        overlay.setColors({ color: '#00000000', symbolColor });
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    return () => observer.disconnect();
  }, [headerFg, maskColor]);

  return (
    <BAIFlex
      data-testid="webui-header"
      align="center"
      justify="between"
      direction="row"
      style={{
        height: token.Layout?.headerHeight || 60,
        backgroundColor: token.Layout?.headerBg,
        // Keep clear of the native window buttons drawn over the header in the
        // desktop app (Window Controls Overlay); adds nothing in a browser.
        paddingRight: `calc(${token.marginLG}px + 100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))`,
        paddingLeft: token.marginLG,
        color: token.colorBgBase,
      }}
      className={`${styles.webuiHeader} bai-webui-header`}
    >
      <BAIFlex data-testid="label-selector-project" direction="row" gap={'sm'}>
        <ReverseThemeProvider>
          {!gridBreakpoint.sm && (
            <Button
              icon={<MenuIcon />}
              type="text"
              onClick={() => {
                onClickMenuIcon?.();
              }}
              className="non-draggable"
              style={{
                marginLeft: token.marginSM * -1,
              }}
            />
          )}
          {gridBreakpoint.sm && (
            <Typography.Text
              style={{
                fontWeight: 600, // semi-bold
                fontSize: token.fontSizeLG,
              }}
            >
              {t('webui.menu.Project')}
            </Typography.Text>
          )}
        </ReverseThemeProvider>
        <Suspense>
          <ProjectSelect
            data-testid="selector-project"
            ghost
            popupMatchSelectWidth={false}
            style={{
              minWidth: 100,
              maxWidth: gridBreakpoint.lg ? undefined : 150,
            }}
            loading={isProjectChanging}
            disabled={isProjectChanging}
            className="non-draggable"
            showSearch
            domain={currentDomainName}
            value={
              isProjectChanging
                ? optimisticProjectId
                : isUrlProjectInvalid
                  ? undefined
                  : currentProject?.id
            }
            onSelectProject={(projectInfo) => {
              const isTargetProjectAdmin = projectAdminIds.includes(
                projectInfo.projectId,
              );

              // In admin mode, switching to a project the user is NOT a
              // project-admin of means leaving admin mode. Confirm first so
              // the user doesn't accidentally lose their admin context.
              if (
                isSelectedAdminCategoryMenu &&
                effectiveAdminRole === 'currentProjectAdmin' &&
                !isTargetProjectAdmin
              ) {
                // Optimistically show the target project (with loading) while
                // the confirm modal is open, so the user sees where they are
                // about to switch to.
                setOptimisticProjectId(projectInfo.projectId);
                setIsConfirmingProjectSwitch(true);
                modal.confirm({
                  title: t('header.SwitchOutOfAdminConfirmTitle'),
                  content: t('header.SwitchOutOfAdminConfirmContent', {
                    projectName: projectInfo.projectName,
                  }),
                  okText: t('button.Confirm'),
                  cancelText: t('button.Cancel'),
                  onOk: () => {
                    setIsConfirmingProjectSwitch(false);
                    setOptimisticProjectId(projectInfo.projectId);
                    // Leaving admin mode: switch to the target project (atom)
                    // and navigate to the last-visited general page, but rewrite
                    // that page's project segment to the NEW project so the
                    // project-scope layout doesn't immediately sync the atom
                    // back to the old project's name.
                    startProjectChangedTransition(() => {
                      setCurrentProject(projectInfo);
                    });
                    // Return to the last-visited general page, preserving its
                    // full sub-path (e.g. /session/start) and swapping ONLY the
                    // project segment to the NEW project, so the project-scope
                    // layout does not sync the atom back to the old project.
                    const fallbackFeature =
                      currentMenuKey &&
                      MENU_KEY_TO_SCOPE_FEATURE[currentMenuKey]?.scope ===
                        'project'
                        ? MENU_KEY_TO_SCOPE_FEATURE[currentMenuKey].featureKey
                        : 'session';
                    let target = buildPath(
                      'project',
                      fallbackFeature,
                      projectInfo.projectName,
                    );
                    if (goBackPath) {
                      const segments = goBackPath.split('/');
                      if (segments[1] === 'project' && segments.length > 2) {
                        target = rewriteProjectNameInPath(
                          goBackPath,
                          projectInfo.projectName,
                        );
                      }
                    }
                    webuiNavigate(target);
                  },
                  onCancel: () => {
                    // Revert the optimistic selection back to the current
                    // project so the dropdown reflects the unchanged state.
                    setIsConfirmingProjectSwitch(false);
                    setOptimisticProjectId(currentProject.id);
                  },
                });
                return;
              }

              applyProjectChange(projectInfo);
            }}
          />
        </Suspense>
      </BAIFlex>
      <BAIFlex
        direction="row"
        className="non-draggable"
        gap="xxs"
        align="center"
      >
        {baiClient.supports('extend-login-session') &&
          baiClient._config.enableExtendLoginSession && (
            <Suspense>
              <LoginSessionExtendButton data-testid="button-extend-login-session" />
              {gridBreakpoint.md && (
                <Divider
                  orientation="vertical"
                  style={{ borderColor: 'transparent' }}
                />
              )}
            </Suspense>
          )}
        <BAINotificationButton data-testid="button-notification" />
        <ReverseThemeProvider>
          <WebUIThemeToggleButton data-testid="button-theme" />
          <WEBUIHelpButton data-testid="button-help" />
        </ReverseThemeProvider>
        <UserDropdownMenu
          data-testid="dropdown-user-menu"
          buttonRender={(btn) => (
            //  Add a `div` to resolve the Dropdown bug when the child is a `ConfigProvider`(ReverseThemeProvider).
            <div>
              <ReverseThemeProvider>{btn}</ReverseThemeProvider>
            </div>
          )}
          style={{
            marginLeft: token.marginXXS,
            marginRight: token.marginSM * -1,
            paddingLeft: token.paddingSM,
            paddingRight: token.paddingSM,
          }}
        />
      </BAIFlex>
      {modalContextHolder}
    </BAIFlex>
  );
};

export default WebUIHeader;
