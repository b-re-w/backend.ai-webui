/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
/**
 * Lab addition: tells the desktop app's main process the settings it needs to
 * decide where links open (the default browser or an app window), together with
 * the API endpoint host that session apps are served under, and whether to check
 * for app updates. Renders nothing and does nothing outside the desktop app.
 */
import { useSuspendedBackendaiClient } from '../hooks';
import { useBAISettingUserState } from '../hooks/useBAISetting';
import { useEffect } from 'react';

interface LabDesktopBridge {
  setSettings: (settings: {
    openLinksExternally: boolean;
    endpointHost: string;
    autoUpdate: boolean;
  }) => void;
}

export function endpointHost(endpoint?: string | null): string {
  try {
    return endpoint ? new URL(endpoint).hostname : '';
  } catch {
    return '';
  }
}

const LabDesktopSettingsSync: React.FC = () => {
  'use memo';
  const [openLinksExternally] = useBAISettingUserState('open_links_externally');
  const [automaticUpdateCheck] = useBAISettingUserState(
    'automatic_update_check',
  );
  const baiClient = useSuspendedBackendaiClient();
  const host = endpointHost(baiClient?._config?.endpoint);
  const enabled = openLinksExternally !== false;
  const autoUpdate = automaticUpdateCheck !== false;

  useEffect(() => {
    const bridge = (globalThis as { __labDesktop?: LabDesktopBridge })
      .__labDesktop;
    bridge?.setSettings({
      openLinksExternally: enabled,
      endpointHost: host,
      autoUpdate,
    });
  }, [enabled, host, autoUpdate]);

  return null;
};

export default LabDesktopSettingsSync;
