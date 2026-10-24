import { useEffect, useRef, useState, type FormEvent } from "react";
import { Globe, Star, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input, cn } from "@store-builder/ui";
import {
  apiErrorCode,
  apiErrorDetails,
  domainSetRedirectToPrimary,
  funnelsList,
  storeDesignAddDomain,
  storeDesignCheckDomainSsl,
  storeDesignDeleteDomain,
  storeDesignDomainDnsCheck,
  storeDesignDomainsOverview,
  storeDesignUpdateDomain,
  storeDesignVerifyDomain,
  type StoreDomain,
  type StoreDomainDnsCheck,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage, type ErrorOverrides } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState, StateMessage } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { EmptyState } from "@/components/EmptyState";
import { Section } from "@/components/Section";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { DOMAIN_REDIRECT_ENABLED } from "@/lib/features";
import { DomainGuides } from "./DomainGuides";
import { DomainRedirectSwitch } from "./DomainRedirectSwitch";
import { cleanHostname, isApex, registrableDomain, relativeName } from "./domainNames";

const STRINGS = {
  en: {
    addTitle: "Connect a domain",
    addDescription: "Connect a subdomain of a domain you own, such as www.example.com or shop.example.com.",
    hostname: "Domain",
    add: "Connect",
    adding: "Connecting…",
    apexNotice:
      "Only a subdomain can be connected, so we filled in {www}: press Connect. Then forward {apex} to https://{www} at your registrar (the steps are shown after you connect).",
    emptyTitle: "No domain connected yet",
    emptyBody: "Your store already works on its free address. Connect your own domain to use it instead.",
    waiting: "Waiting for DNS",
    verified: "Verified",
    issuing: "Issuing certificate",
    active: "Active",
    failed: "Failed",
    moved: "No longer pointing to your store",
    suspended: "Suspended",
    suspended_store_suspended: "Your store is suspended, so this domain is not served. It comes back when the store does.",
    suspended_plan: "Your plan does not include custom domains, so this domain is not served. It comes back when the plan does.",
    failedNoReason: "The certificate could not be issued. Check the records below, then check the certificate again.",
    movedHint: "The CNAME record no longer points to us. Add it again to bring the domain back.",
    primary: "Primary",
    stepsTitle: "Add these two records at your DNS provider",
    stepsHint: "Delete any other record on the same names. Some providers want only the part before your domain in Name, as shown.",
    type: "Type",
    name: "Name",
    value: "Value",
    ttl: "TTL",
    copy: "Copy",
    found: "Found",
    notFound: "Not found yet",
    polling: "Checking automatically every 30 seconds while this page is open.",
    verify: "Verify domain",
    checkDns: "Check DNS",
    checkSsl: "Check certificate",
    makePrimary: "Make primary",
    remove: "Remove",
    homeFunnel: "Home funnel",
    homeFunnelHint: "The funnel that opens on this domain's root instead of the store home. Only published funnels are listed.",
    storeHome: "Store home page",
    verifiedToast: "Domain verified.",
    savedToast: "Domain updated.",
    removedToast: "Domain removed.",
    removeTitle: "Remove this domain?",
    removeBody: "Shoppers opening it will no longer reach your store. Your free store address keeps working.",
    noProvider: "No certificate provider is configured yet; certificates cannot be requested.",
    unavailableTitle: "Custom domains are not available right now",
    unavailableBody: "This feature is not switched on yet. Your store keeps working on its free address.",
    DOMAIN_TAKEN: "That domain is already connected to another store.",
    DOMAIN_ALREADY_ADDED: "That domain is already on this store.",
    DOMAIN_LIMIT_REACHED: "Your store has reached its number of domains. Remove one to connect another.",
    DOMAIN_NOT_ALLOWED: "That domain cannot be connected to a store.",
    DOMAIN_NOT_VERIFIED: "The TXT record was not found yet. Add it and try again in a few minutes.",
    DOMAIN_VERIFICATION_EXPIRED: "This domain was not verified within 7 days. Remove it and connect it again.",
    APEX_NOT_SUPPORTED: "Only a subdomain such as www.example.com can be connected.",
  },
  ar: {
    addTitle: "ربط دومين",
    addDescription: "اربط دومينًا فرعيًا من دومين تملكه، مثل www.example.com أو shop.example.com.",
    hostname: "الدومين",
    add: "ربط",
    adding: "جارٍ الربط…",
    apexNotice:
      "يمكن ربط الدومين الفرعي فقط، لذلك كتبنا لك {www}: اضغط ربط. بعد ذلك وجّه {apex} إلى https://{www} عند مزوّد الدومين (تظهر الخطوات بعد الربط).",
    emptyTitle: "لا يوجد دومين مربوط بعد",
    emptyBody: "متجرك يعمل بالفعل على عنوانه المجاني. اربط دومينك الخاص لاستخدامه بدلًا منه.",
    waiting: "في انتظار الـ DNS",
    verified: "تم التحقق",
    issuing: "جارٍ إصدار الشهادة",
    active: "يعمل",
    failed: "فشل",
    moved: "لم يعد يشير إلى متجرك",
    suspended: "موقوف",
    suspended_store_suspended: "متجرك موقوف، لذلك لا يعمل هذا الدومين. يعود للعمل عند عودة المتجر.",
    suspended_plan: "خطتك لا تشمل الدومينات الخاصة، لذلك لا يعمل هذا الدومين. يعود للعمل عند ترقية الخطة.",
    failedNoReason: "تعذّر إصدار الشهادة. راجع السجلات أدناه ثم افحص الشهادة مرة أخرى.",
    movedHint: "سجل CNAME لم يعد يشير إلينا. أضفه مرة أخرى لإعادة الدومين.",
    primary: "الأساسي",
    stepsTitle: "أضف هذين السجلين عند مزوّد الـ DNS",
    stepsHint: "احذف أي سجل آخر على نفس الأسماء. بعض المزوّدين يطلبون في خانة الاسم الجزء الذي قبل دومينك فقط، كما هو معروض.",
    type: "النوع",
    name: "الاسم",
    value: "القيمة",
    ttl: "TTL",
    copy: "نسخ",
    found: "موجود",
    notFound: "غير موجود بعد",
    polling: "نتحقق تلقائيًا كل 30 ثانية ما دامت هذه الصفحة مفتوحة.",
    verify: "تحقق من الدومين",
    checkDns: "فحص الـ DNS",
    checkSsl: "فحص الشهادة",
    makePrimary: "اجعله الأساسي",
    remove: "حذف",
    homeFunnel: "مسار البيع الرئيسي",
    homeFunnelHint: "مسار البيع الذي يفتح على جذر هذا الدومين بدل الصفحة الرئيسية للمتجر. تظهر المسارات المنشورة فقط.",
    storeHome: "الصفحة الرئيسية للمتجر",
    verifiedToast: "تم التحقق من الدومين.",
    savedToast: "تم تحديث الدومين.",
    removedToast: "تم حذف الدومين.",
    removeTitle: "حذف هذا الدومين؟",
    removeBody: "من يفتحه لن يصل إلى متجرك. عنوان متجرك المجاني يظل يعمل.",
    noProvider: "لم يُضبط مزود شهادات بعد؛ لا يمكن طلب شهادات.",
    unavailableTitle: "ميزة الدومينات غير متاحة حاليًا",
    unavailableBody: "لم تُفعَّل هذه الميزة بعد. متجرك يعمل على عنوانه المجاني كالمعتاد.",
    DOMAIN_TAKEN: "هذا الدومين مربوط بمتجر آخر بالفعل.",
    DOMAIN_ALREADY_ADDED: "هذا الدومين مضاف إلى هذا المتجر بالفعل.",
    DOMAIN_LIMIT_REACHED: "وصل متجرك إلى الحد الأقصى من الدومينات. احذف دومينًا لربط آخر.",
    DOMAIN_NOT_ALLOWED: "لا يمكن ربط هذا الدومين بمتجر.",
    DOMAIN_NOT_VERIFIED: "لم نجد سجل TXT بعد. أضفه وحاول مرة أخرى بعد دقائق.",
    DOMAIN_VERIFICATION_EXPIRED: "لم يتم التحقق من هذا الدومين خلال 7 أيام. احذفه واربطه مرة أخرى.",
    APEX_NOT_SUPPORTED: "يمكن ربط دومين فرعي فقط مثل www.example.com.",
  },
} satisfies Messages;

type Display = "waiting" | "verified" | "issuing" | "active" | "failed" | "moved" | "suspended";

/** One status for the merchant, from ownership, certificate and suspension together. */
function displayOf(domain: StoreDomain, hasProvider: boolean): Display {
  if (domain.suspended) return "suspended";
  if (domain.status === "pending_verification") return "waiting";
  if (domain.status === "failed" || domain.sslStatus === "failed") return "failed";
  if (domain.sslStatus === "moved") return "moved";
  if (domain.status === "active" && domain.sslStatus === "issued") return "active";
  if (hasProvider && (domain.sslStatus === "pending" || domain.sslStatus === "none")) return "issuing";
  return "verified";
}

const TONE: Record<Display, string> = {
  waiting: "text-ink-soft",
  verified: "text-ink-soft",
  issuing: "text-ink-soft",
  active: "text-success",
  failed: "text-danger",
  moved: "text-danger",
  suspended: "text-danger",
};

const POLL_MS = 30_000;

export function DomainsTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const state = useAsync(() => storeDesignDomainsOverview(apiClient, workspaceId), [workspaceId]);
  // Funnels are optional here: a role without funnel access still manages domains.
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  const [hostname, setHostname] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [apexNotice, setApexNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dns, setDns] = useState<Record<string, StoreDomainDnsCheck>>({});
  const [removing, setRemoving] = useState<StoreDomain | null>(null);

  const overrides: ErrorOverrides = {
    DOMAIN_TAKEN: t.DOMAIN_TAKEN,
    DOMAIN_ALREADY_ADDED: t.DOMAIN_ALREADY_ADDED,
    DOMAIN_LIMIT_REACHED: t.DOMAIN_LIMIT_REACHED,
    DOMAIN_NOT_ALLOWED: t.DOMAIN_NOT_ALLOWED,
    DOMAIN_NOT_VERIFIED: t.DOMAIN_NOT_VERIFIED,
    DOMAIN_VERIFICATION_EXPIRED: t.DOMAIN_VERIFICATION_EXPIRED,
    APEX_NOT_SUPPORTED: t.APEX_NOT_SUPPORTED,
  };
  const hasProvider = Boolean(state.data?.certificateProvider);
  const domains = state.data?.domains ?? [];
  const publishedFunnels = (funnels.data ?? []).filter((f) => f.status === "published");

  /** A bare domain becomes www.<domain> in the field, with the reason. */
  function offerWww(apex: string) {
    const www = `www.${apex}`;
    setHostname(www);
    setApexNotice(fmt(t.apexNotice, { www, apex }));
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const host = cleanHostname(hostname);
    if (!host || adding) return;
    setAddError(null);
    if (isApex(host)) {
      offerWww(host);
      return;
    }
    setAdding(true);
    try {
      await storeDesignAddDomain(apiClient, workspaceId, host);
      setHostname("");
      setApexNotice(null);
      await state.refresh({ silent: true });
    } catch (err) {
      if (apiErrorCode(err) === "APEX_NOT_SUPPORTED") {
        const suggestion = apiErrorDetails<{ suggestion?: string }>(err)?.suggestion;
        if (suggestion) {
          offerWww(suggestion.replace(/^www\./, ""));
          return;
        }
      }
      setAddError(errorMessage(err, overrides));
    } finally {
      setAdding(false);
    }
  }

  /** Runs one action on a domain, then re-reads the list. */
  async function run(domain: StoreDomain, key: string, action: () => Promise<string | void>) {
    setBusy(`${domain.id}:${key}`);
    try {
      const message = await action();
      if (message) toast.success(message);
      await state.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, overrides));
    } finally {
      setBusy(null);
    }
  }

  // The server asks for the certificate itself once the domain is verified.
  const verify = (domain: StoreDomain) =>
    run(domain, "verify", async () => {
      await storeDesignVerifyDomain(apiClient, workspaceId, domain.id);
      return t.verifiedToast;
    });

  // While a domain waits for DNS or its certificate, check every 30 seconds
  // as long as this tab is open and visible. Errors stay silent: the buttons
  // show them when the merchant asks.
  const waiting = domains.filter((d) => {
    const display = displayOf(d, hasProvider);
    return display === "waiting" || display === "issuing";
  });
  const waitingKey = waiting.map((d) => `${d.id}:${displayOf(d, hasProvider)}`).join(",");
  const latest = useRef({ waiting, hasProvider });
  latest.current = { waiting, hasProvider };
  useEffect(() => {
    if (!waitingKey) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void (async () => {
        for (const domain of latest.current.waiting) {
          if (domain.status === "pending_verification") {
            await storeDesignVerifyDomain(apiClient, workspaceId, domain.id).catch(() => undefined);
          } else if (latest.current.hasProvider) {
            await storeDesignCheckDomainSsl(apiClient, workspaceId, domain.id).catch(() => undefined);
          }
        }
        await state.refresh({ silent: true });
      })();
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed only when the waiting set changes
  }, [waitingKey, workspaceId]);

  // The API answers every domains route with its 404 for an unknown path until
  // its own CUSTOM_DOMAINS_ENABLED is on: the feature is off, nothing failed.
  if (!state.loading && apiErrorCode(state.error) === "ROUTE_NOT_FOUND") {
    return <StateMessage role="status" icon={<Globe aria-hidden />} title={t.unavailableTitle} description={t.unavailableBody} />;
  }

  return (
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()}>
      <div className="space-y-5">
        {state.data && state.data.certificateProvider === null && <Alert variant="danger">{t.noProvider}</Alert>}

        <Section title={t.addTitle} description={t.addDescription} searchAnchor="connect-domain">
          <form onSubmit={add} className="flex flex-wrap items-start gap-2">
            <Field label={t.hostname} error={addError ?? undefined} labelHidden className="min-w-0 flex-1">
              {({ id, ...aria }) => (
                <Input
                  id={id}
                  {...aria}
                  dir="ltr"
                  placeholder="www.example.com"
                  value={hostname}
                  disabled={adding}
                  onChange={(e) => {
                    setHostname(e.target.value);
                    setApexNotice(null);
                  }}
                />
              )}
            </Field>
            <Button type="submit" disabled={adding || !hostname.trim()}>
              {adding ? t.adding : t.add}
            </Button>
          </form>
          {apexNotice && (
            <Alert className="mt-3" role="status">
              {apexNotice}
            </Alert>
          )}
        </Section>

        {state.data && domains.length === 0 ? (
          <EmptyState icon={<Globe />} title={t.emptyTitle} description={t.emptyBody} />
        ) : (
          domains.map((domain) => {
            const usable = domain.status === "verified" || domain.status === "active";
            const display = displayOf(domain, hasProvider);
            const check = dns[domain.id];
            const isBusy = (key: string) => busy === `${domain.id}:${key}`;
            const apex = registrableDomain(domain.hostname);
            const cname = domain.records.find((r) => r.type === "CNAME");
            const txt = domain.records.find((r) => r.type === "TXT");
            const reason =
              display === "suspended" && domain.suspendedReason
                ? t[`suspended_${domain.suspendedReason}`]
                : display === "failed"
                  ? (domain.sslDetail ?? t.failedNoReason)
                  : display === "moved"
                    ? t.movedHint
                    : null;
            return (
              <Section
                key={domain.id}
                title={domain.hostname}
                actions={
                  <>
                    {domain.isPrimary && (
                      <Badge>
                        <Star className="size-3" />
                        {t.primary}
                      </Badge>
                    )}
                    <span className={cn("text-xs font-medium", TONE[display])} aria-live="polite">
                      {t[display]}
                    </span>
                  </>
                }
              >
                <div className="space-y-4">
                  {reason && (
                    <Alert variant={display === "failed" || display === "moved" ? "danger" : undefined}>
                      <bdi>{reason}</bdi>
                    </Alert>
                  )}

                  {display !== "active" && (
                    <div>
                      <p className="text-sm font-medium text-ink">{t.stepsTitle}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">{t.stepsHint}</p>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[36rem] text-start text-sm">
                          <thead className="text-xs text-ink-soft">
                            <tr>
                              <th className="pb-2 pe-3 text-start font-medium">{t.type}</th>
                              <th className="pb-2 pe-3 text-start font-medium">{t.name}</th>
                              <th className="pb-2 pe-3 text-start font-medium">{t.value}</th>
                              <th className="pb-2 pe-3 text-start font-medium">{t.ttl}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {[cname, txt].filter((r) => r !== undefined).map((record) => {
                              const result = check ? (record.type === "TXT" ? check.txt.found : check.cname.found) : null;
                              const short = relativeName(record.name, apex);
                              return (
                                <tr key={record.type}>
                                  <td className="py-2 pe-3 font-medium text-ink">{record.type}</td>
                                  <td className="py-2 pe-3">
                                    <span className="inline-flex items-center gap-1">
                                      <bdi dir="ltr" className="font-mono text-xs">
                                        {short}
                                      </bdi>
                                      <CopyButton value={short} label={t.copy} />
                                    </span>
                                    {short !== record.name && (
                                      <bdi dir="ltr" className="block text-xs text-ink-soft">
                                        {record.name}
                                      </bdi>
                                    )}
                                  </td>
                                  <td className="py-2 pe-3">
                                    <span className="inline-flex items-center gap-1">
                                      <bdi dir="ltr" className="break-all font-mono text-xs">
                                        {record.value}
                                      </bdi>
                                      <CopyButton value={record.value} label={t.copy} />
                                    </span>
                                    {result !== null && (
                                      <span className={cn("ms-2 text-xs font-medium", result ? "text-success" : "text-danger")}>
                                        {result ? t.found : t.notFound}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 pe-3 text-ink-soft">{record.ttl}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {(display === "waiting" || display === "issuing") && (
                        <p className="mt-2 text-xs text-ink-soft">{t.polling}</p>
                      )}
                    </div>
                  )}

                  {display !== "active" && cname && txt && (
                    <DomainGuides
                      hostname={domain.hostname}
                      apex={apex}
                      cnameName={relativeName(cname.name, apex)}
                      cnameValue={cname.value}
                      txtName={relativeName(txt.name, apex)}
                      txtValue={txt.value}
                    />
                  )}

                  {usable && (
                    <Field label={t.homeFunnel} hint={t.homeFunnelHint}>
                      {({ id }) => (
                        <Select
                          id={id}
                          value={domain.homeFunnel?.id ?? ""}
                          disabled={isBusy("funnel")}
                          onChange={(e) =>
                            void run(domain, "funnel", async () => {
                              await storeDesignUpdateDomain(apiClient, workspaceId, domain.id, {
                                homeFunnelId: e.target.value || null,
                              });
                              return t.savedToast;
                            })
                          }
                        >
                          <option value="">{t.storeHome}</option>
                          {/* Keeps a funnel that was unpublished after being chosen visible. */}
                          {domain.homeFunnel && !publishedFunnels.some((f) => f.id === domain.homeFunnel?.id) && (
                            <option value={domain.homeFunnel.id}>{domain.homeFunnel.name}</option>
                          )}
                          {publishedFunnels.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  )}

                  {DOMAIN_REDIRECT_ENABLED && usable && !domain.isPrimary && (
                    <DomainRedirectSwitch
                      domain={domain}
                      disabled={isBusy("redirect")}
                      onChange={(redirectToPrimary) =>
                        void run(domain, "redirect", async () => {
                          await domainSetRedirectToPrimary(apiClient, workspaceId, domain.id, redirectToPrimary);
                          return t.savedToast;
                        })
                      }
                    />
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!usable && (
                      <Button size="sm" disabled={isBusy("verify")} onClick={() => void verify(domain)}>
                        {t.verify}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy("dns")}
                      onClick={() =>
                        void run(domain, "dns", async () => {
                          const result = await storeDesignDomainDnsCheck(apiClient, workspaceId, domain.id);
                          setDns((prev) => ({ ...prev, [domain.id]: result }));
                        })
                      }
                    >
                      {t.checkDns}
                    </Button>
                    {usable && hasProvider && domain.sslStatus !== "issued" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy("ssl")}
                        onClick={() =>
                          void run(domain, "ssl", async () => {
                            const { detail } = await storeDesignCheckDomainSsl(apiClient, workspaceId, domain.id);
                            return detail ?? undefined;
                          })
                        }
                      >
                        {t.checkSsl}
                      </Button>
                    )}
                    {usable && !domain.isPrimary && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy("primary")}
                        onClick={() =>
                          void run(domain, "primary", async () => {
                            await storeDesignUpdateDomain(apiClient, workspaceId, domain.id, { isPrimary: true });
                            return t.savedToast;
                          })
                        }
                      >
                        {t.makePrimary}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(domain)}>
                      <Trash2 className="size-4 text-danger" />
                      {t.remove}
                    </Button>
                  </div>
                </div>
              </Section>
            );
          })
        )}

        <ConfirmDialog
          open={removing !== null}
          title={t.removeTitle}
          description={t.removeBody}
          confirmLabel={t.remove}
          destructive
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            if (!removing) return;
            await storeDesignDeleteDomain(apiClient, workspaceId, removing.id);
            setRemoving(null);
            toast.success(t.removedToast);
            await state.refresh({ silent: true });
          }}
        />
      </div>
    </DataState>
  );
}
