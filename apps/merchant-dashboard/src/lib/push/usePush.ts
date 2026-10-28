import { useCallback, useEffect, useMemo, useState } from "react";
import { pushListDevices, type PushConfig, type PushDevice } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { PUSH_ENABLED } from "@/lib/features";
import { platformOf, pushSupport, readFacts, type Platform, type PushSupport } from "./environment";
import { isOnHere, loadPushConfig } from "./pushClient";

export type PushConfigState = { status: "loading" } | { status: "off" } | { status: "on"; config: PushConfig };

/**
 * Whether device notifications are on: VITE_PUSH_ENABLED here and the API's
 * /me/push/config (a 404 there, or any failure, reads as off). Read once per page.
 */
export function usePushConfig(): PushConfigState {
  const [state, setState] = useState<PushConfigState>(() => (PUSH_ENABLED ? { status: "loading" } : { status: "off" }));
  useEffect(() => {
    if (!PUSH_ENABLED) return;
    let live = true;
    loadPushConfig().then(
      (config) => live && setState(config ? { status: "on", config } : { status: "off" }),
      () => live && setState({ status: "off" })
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export type Permission = NotificationPermission | "unavailable";

export const permissionNow = (): Permission => (typeof Notification === "undefined" ? "unavailable" : Notification.permission);

export interface PushHere {
  support: PushSupport;
  platform: Platform;
  standalone: boolean;
  permission: Permission;
  /** This browser receives this account's notifications; null while it is being read. */
  on: boolean | null;
  /** My devices for the dashboard (from the API); null while loading or when it failed. */
  devices: PushDevice[] | null;
  /** Read it all again (after turning on or off, or a change in another tab). */
  refresh: () => Promise<void>;
  setPermission: (permission: Permission) => void;
}

/** What this browser and account have of device notifications, for Settings → My notifications. */
export function usePushHere(userId: string | null, active: boolean): PushHere {
  const facts = useMemo(() => readFacts(), []);
  const [permission, setPermission] = useState<Permission>(permissionNow);
  const [on, setOn] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<PushDevice[] | null>(null);

  const refresh = useCallback(async () => {
    if (!active || !userId) return;
    const [here, list] = await Promise.all([
      isOnHere(userId).catch(() => false),
      pushListDevices(apiClient, "dashboard").then(
        (result) => result.subscriptions,
        () => null
      ),
    ]);
    setPermission(permissionNow());
    setOn(here);
    setDevices(list);
  }, [active, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    support: pushSupport(facts),
    platform: platformOf(facts),
    standalone: facts.standalone,
    permission,
    on,
    devices,
    refresh,
    setPermission,
  };
}
