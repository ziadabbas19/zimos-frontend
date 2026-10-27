import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { twoFactorRecoveryAdminReset, twoFactorRecoveryOfUser } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { TWO_FACTOR_ENABLED } from "@/lib/features";
import { P } from "@/lib/permissions";
import { TWO_FACTOR_STRINGS, modeLabel } from "@/lib/twoFactorStrings";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { CopyId } from "@/components/CopyId";
import { StoreLink } from "@/components/StoreLink";
import { UserModerationActions, UserStateBadge } from "@/components/userModeration";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { SITE_TRAFFIC_STRINGS, formatDuration } from "@/lib/siteTrafficStrings";
import { countryName, governorateName } from "@/lib/storeTrafficStrings";
import type { AdminUserAcquisition, AdminUserDetail, AdminUserLocation } from "@store-builder/api-client";

/** Where the account came from on the marketing site (backend user_acquisition). */
function AcquisitionPanel({ acquisition }: { acquisition: AdminUserAcquisition | null }) {
  const t = useT(SITE_TRAFFIC_STRINGS);
  const { locale } = useLocale();
  if (!acquisition) {
    return (
      <Panel title={t.acquisition}>
        <p className="text-sm text-ink-soft">{t.acquisitionNone}</p>
      </Panel>
    );
  }
  const source = acquisition.utmSource ?? acquisition.referrerHost ?? t.direct;
  const campaign = [acquisition.utmMedium, acquisition.utmCampaign].filter(Boolean).join(" / ");
  return (
    <Panel title={t.acquisition}>
      <dl>
        <DetailRow label={t.source}>
          <bdi dir="ltr">{source}</bdi>
        </DetailRow>
        {campaign && (
          <DetailRow label={t.campaign}>
            <bdi dir="ltr">{campaign}</bdi>
          </DetailRow>
        )}
        <DetailRow label={t.landingPage}>{acquisition.landingPath ? <bdi dir="ltr">{acquisition.landingPath}</bdi> : "—"}</DetailRow>
        <DetailRow label={t.firstVisit}>{formatDateTime(acquisition.firstVisitAt)}</DetailRow>
        <DetailRow label={t.beforeSignup}>{formatDuration(acquisition.secondsBeforeSignup, locale)}</DetailRow>
      </dl>
    </Panel>
  );
}

/**
 * Where they were when they signed up, as the marketing site kept it (backend
 * site_visits, from Cloudflare's headers): the IP's region, approximate, and
 * no city. "Not recorded" when they signed up without a tracked visit.
 */
function LocationRow({ location }: { location: AdminUserLocation | null }) {
  const { locale } = useLocale();
  if (!location) {
    return (
      <DetailRow label="Location">
        <span className="text-ink-soft">Not recorded</span>
      </DetailRow>
    );
  }
  const place = [
    location.governorate ? governorateName(location.governorate, locale, location.governorate) : null,
    location.country ? countryName(location.country, locale) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <DetailRow label="Location">
      <bdi>{place}</bdi>
      <span className="ms-2 text-xs text-ink-soft">approximate, at sign-up · {formatDate(location.seenAt)}</span>
    </DetailRow>
  );
}

/** One account: who they are, and every store they own or work in. */
/**
 * A person's second step, and support's reset for someone locked out of it
 * (POST /admin/users/:id/two-factor/reset, support.manage). The reset is not
 * offered on your own account, on a deleted one, or when the step is known to
 * be off; the API applies the rest of the console's target rules.
 */
function TwoFactorRow({ user, onReset }: { user: AdminUserDetail; onReset: () => void }) {
  const t = useT(TWO_FACTOR_STRINGS);
  const toast = useToast();
  const { can, user: me } = useAuth();
  const [resetting, setResetting] = useState(false);
  const twoFactor = twoFactorRecoveryOfUser(user);
  const mode = twoFactor ? twoFactor.mode : null;
  const canReset = can(P.SUPPORT_MANAGE) && me?.id !== user.id && !user.deletedAt && mode !== "off";

  return (
    <DetailRow label={t.rowLabel}>
      {modeLabel(t, mode)}
      {twoFactor?.enabledAt && <span className="ms-2 text-xs text-ink-soft">{fmt(t.since, { date: formatDate(twoFactor.enabledAt) })}</span>}
      {canReset && (
        <Button size="sm" variant="outline" className="ms-3" onClick={() => setResetting(true)}>
          {t.turnOff}
        </Button>
      )}
      <ConfirmDialog
        open={resetting}
        title={t.resetTitle}
        description={t.resetBody}
        confirmLabel={t.turnOff}
        destructive
        onCancel={() => setResetting(false)}
        onConfirm={async () => {
          await twoFactorRecoveryAdminReset(apiClient, user.id);
          setResetting(false);
          toast.success(t.resetDone);
          onReset();
        }}
      />
    </DetailRow>
  );
}

export function UserDetailPage() {
  const { id = "" } = useParams();
  const { data: user, loading, error, refresh } = useAsync(() => adminApi.getUser(id), [id]);

  return (
    <div>
      <PageHeader
        title={user ? user.fullName : "User"}
        description={user?.username ? `@${user.username}` : undefined}
        back={{ to: "/users", label: "Users" }}
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {user && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Account">
              <dl>
                <DetailRow label="Name">
                  <bdi>{user.fullName}</bdi>
                </DetailRow>
                <DetailRow label="Username">
                  {user.username ? <bdi dir="ltr">@{user.username}</bdi> : <span className="text-ink-soft">Not chosen yet</span>}
                  {user.usernameChangedAt && (
                    <span className="ms-2 text-xs text-ink-soft">changed {formatRelative(user.usernameChangedAt)}</span>
                  )}
                </DetailRow>
                <DetailRow label="Email">
                  <bdi dir="ltr" className="break-all">
                    {user.email}
                  </bdi>
                  {user.emailVerified ? (
                    <StatusBadge tone="success" className="ms-2">
                      Verified
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="warning" className="ms-2">
                      Not verified
                    </StatusBadge>
                  )}
                </DetailRow>
                <DetailRow label="Phone">
                  {user.phone ? <bdi dir="ltr">{user.phone}</bdi> : "—"}
                  {user.phone && user.phoneVerified !== undefined && (
                    <StatusBadge tone={user.phoneVerified ? "success" : "warning"} className="ms-2">
                      {user.phoneVerified ? "Verified" : "Not verified"}
                    </StatusBadge>
                  )}
                </DetailRow>
                {user.location !== undefined && <LocationRow location={user.location} />}
                <DetailRow label="User ID">
                  <CopyId value={user.id} full />
                </DetailRow>
                <DetailRow label="Status">
                  <Status value={user.status} />
                  <span className="ms-2">
                    <UserStateBadge status={user.status} deleted={Boolean(user.deletedAt)} />
                  </span>
                </DetailRow>
                {user.suspendedReason && <DetailRow label="Suspension reason">{user.suspendedReason}</DetailRow>}
                {user.deletedAt && <DetailRow label="Deleted">{formatDate(user.deletedAt)}</DetailRow>}
                <DetailRow label="Platform role">{user.platformRole ?? "—"}</DetailRow>
                <DetailRow label="Joined">
                  {formatDate(user.createdAt)}
                  <span className="ms-2 text-xs text-ink-soft">{formatRelative(user.createdAt)}</span>
                </DetailRow>
                <DetailRow label="Last sign-in">{user.lastLoginAt ? formatRelative(user.lastLoginAt) : "—"}</DetailRow>
                {TWO_FACTOR_ENABLED && <TwoFactorRow user={user} onReset={() => void refresh()} />}
              </dl>
              <div className="mt-4">
                <UserModerationActions user={user} onChanged={() => void refresh()} />
              </div>
            </Panel>

            <Panel title="Stores" flush={user.workspaces.length > 0}>
              {user.workspaces.length === 0 ? (
                <EmptyBlock message="This person owns no store and belongs to none." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>Store</Th>
                      <Th>Role</Th>
                      <Th>Subscription</Th>
                      <Th>Created</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.workspaces.map((s) => (
                      <TableRow key={s.id}>
                        <Td>
                          <Link to={`/workspaces/${s.id}`} className="block font-medium text-ink hover:text-primary">
                            <bdi>{s.name}</bdi>
                          </Link>
                          <span className="block text-xs text-ink-soft">{s.slug}</span>
                          <StoreLink url={s.storeUrl} name={s.name} />
                        </Td>
                        <Td className="capitalize">{s.role.replace(/_/g, " ")}</Td>
                        <Td>
                          {s.subscription ? (
                            <>
                              <Status value={s.subscription.status} />
                              <span className="block text-xs text-ink-soft">
                                {s.subscription.plan ?? "—"} · until {formatDate(s.subscription.currentPeriodEnd)}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td className="text-ink-soft">{s.createdAt ? formatDate(s.createdAt) : "—"}</Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
            <AcquisitionPanel acquisition={user.acquisition ?? null} />
          </div>
        )}
      </DataState>
    </div>
  );
}
