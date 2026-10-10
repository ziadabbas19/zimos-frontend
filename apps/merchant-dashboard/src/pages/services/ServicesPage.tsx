import { useMemo, useState, type ReactNode } from "react";
import { Button, buttonVariants, cn } from "@store-builder/ui";
import { SERVICE_CATEGORIES, serviceListingsList, type ServiceCategory, type ServiceListing } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconEmail, IconExternal, IconSearch, IconServices, IconWhatsApp, type Icon } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatMoney } from "@/lib/format";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { fold, matches } from "@/pages/quotes/kit/Facts";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";

const STRINGS = {
  en: {
    title: "Services",
    description: "Freelancers and agencies who help merchants. You agree the work and the payment with the provider directly — Zimos is not a party to it.",
    searchLabel: "Search the services",
    searchPlaceholder: "Service or provider",
    filter: "Service category",
    listLabel: "Services",
    all: "All",
    cat_page_management: "Page management",
    cat_landing_pages: "Landing pages",
    cat_ugc: "UGC content",
    cat_video: "Video",
    cat_marketing: "Marketing",
    cat_programming: "Programming",
    cat_consulting: "Consulting",
    cat_store_setup: "Store setup",
    cat_design: "Design",
    cat_accounting: "Accounting",
    quote: "Price on request",
    price: "Price",
    provider: "Provider",
    whatsapp: "WhatsApp",
    whatsappName: "Message {name} on WhatsApp",
    website: "Visit the site",
    websiteName: "Visit the site of {name}",
    email: "Email",
    emailName: "Email {name}",
    open: "See the details of {title}",
    emptyTitle: "No services listed yet",
    emptyDescription: "Providers show up here as the Zimos team adds them: page managers, designers, video makers and more.",
    emptyFiltered: "No service matches this search or category",
    clearAll: "Clear the search and category",
    hello: "Hello, I found your service “{title}” on Zimos.",
  },
  ar: {
    title: "الخدمات",
    description: "مستقلون وشركات يساعدون التجار. تتفق على العمل والدفع مع مقدم الخدمة مباشرة — زيموس ليست طرفًا في الاتفاق.",
    searchLabel: "ابحث في الخدمات",
    searchPlaceholder: "الخدمة أو مقدّم الخدمة",
    filter: "تصنيف الخدمة",
    listLabel: "الخدمات",
    all: "الكل",
    cat_page_management: "إدارة الصفحات",
    cat_landing_pages: "صفحات الهبوط",
    cat_ugc: "محتوى UGC",
    cat_video: "فيديو",
    cat_marketing: "تسويق",
    cat_programming: "برمجة",
    cat_consulting: "استشارات",
    cat_store_setup: "تجهيز المتجر",
    cat_design: "تصميم",
    cat_accounting: "محاسبة",
    quote: "السعر عند الطلب",
    price: "السعر",
    provider: "مقدّم الخدمة",
    whatsapp: "واتساب",
    whatsappName: "إرسال واتساب إلى {name}",
    website: "زيارة الموقع",
    websiteName: "زيارة موقع {name}",
    email: "بريد",
    emailName: "إرسال بريد إلكتروني إلى {name}",
    open: "عرض تفاصيل {title}",
    emptyTitle: "لا توجد خدمات بعد",
    emptyDescription: "يظهر مقدمو الخدمات هنا عندما يضيفهم فريق Zimos: مديرو صفحات، مصممون، صانعو فيديو وغيرهم.",
    emptyFiltered: "لا توجد خدمة مطابقة لهذا البحث أو التصنيف",
    clearAll: "مسح البحث والتصنيف",
    hello: "مرحبًا، وجدت خدمتك «{title}» على زيموس.",
  },
} satisfies Messages;

type CategoryFilter = "all" | ServiceCategory;

// The round contact pills of a card: the recipe of ContactActions (the glass layer tints its two data-slots),
// 44px under a finger and 36px with a mouse.
const ROUND =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] pointer-fine:size-9 motion-reduce:transition-none motion-reduce:active:scale-100";
const TINT_WHATSAPP = "bg-success-soft text-success hover:bg-success hover:text-paper-raised";
const TINT_BRAND = "bg-primary-soft text-primary-dark hover:bg-primary hover:text-primary-foreground";

/** One way to reach a provider, as a round icon link. */
function RoundLink({ href, label, icon: LinkIcon, whatsapp = false, external = true }: { href: string; label: string; icon: Icon; whatsapp?: boolean; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={label}
      title={label}
      data-slot={whatsapp ? "contact-whatsapp" : "contact-call"}
      className={cn(ROUND, whatsapp ? TINT_WHATSAPP : TINT_BRAND)}
    >
      <LinkIcon className="size-5" aria-hidden />
    </a>
  );
}

/**
 * Services marketplace: the providers directory. Search narrows
 * it as it is typed and the categories are chips with how many each holds. A
 * listing is a card — what it is, what it costs, who offers it, and one tap
 * to reach them; a press on the card opens the whole description in a sheet
 * with every way to get in touch. The list is kept for the session: coming
 * back shows it at once and reads it again behind.
 */
export function ServicesPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const phone = useIsPhone();
  const list = useCachedAsync<ServiceListing[]>("service-listings", () => serviceListingsList(apiClient), []);
  const listings = useMemo(() => list.data ?? [], [list.data]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  // The listing being read stays here while its sheet closes, so the sheet does not empty on its way out.
  const [reading, setReading] = useState<{ listing: ServiceListing; open: boolean } | null>(null);

  const titleOf = (l: ServiceListing) => (locale === "ar" && l.titleAr ? l.titleAr : l.title);
  const descriptionOf = (l: ServiceListing) => (locale === "ar" && l.descriptionAr ? l.descriptionAr : l.description);
  const whatsappHref = (l: ServiceListing) => `https://wa.me/${l.contactWhatsapp}?text=${encodeURIComponent(fmt(t.hello, { title: titleOf(l) }))}`;

  const query = fold(search.trim());
  const found = useMemo(
    () => (query ? listings.filter((l) => matches(query, [l.title, l.titleAr, l.providerName, l.description, l.descriptionAr])) : listings),
    [listings, query]
  );
  const shown = category === "all" ? found : found.filter((l) => l.category === category);
  // Only the categories that hold something: the row stays short.
  const used = SERVICE_CATEGORIES.filter((key) => listings.some((l) => l.category === key));
  const chips: ChipItem<CategoryFilter>[] = [
    { value: "all", label: t.all, count: found.length },
    ...used.map((key) => ({ value: key, label: t[`cat_${key}`], count: found.filter((l) => l.category === key).length })),
  ];

  const priceOf = (l: ServiceListing): ReactNode =>
    l.priceAmount !== null && l.priceCurrency ? <bdi dir="ltr">{formatMoney(l.priceAmount, l.priceCurrency)}</bdi> : null;

  /** The ONE action of a card: WhatsApp when the provider has it, else their site, else an email. */
  const actionOf = (l: ServiceListing) =>
    l.contactWhatsapp ? (
      <RoundLink href={whatsappHref(l)} label={fmt(t.whatsappName, { name: l.providerName })} icon={IconWhatsApp} whatsapp />
    ) : l.contactUrl ? (
      <RoundLink href={l.contactUrl} label={fmt(t.websiteName, { name: l.providerName })} icon={IconExternal} />
    ) : l.contactEmail ? (
      <RoundLink href={`mailto:${l.contactEmail}`} label={fmt(t.emailName, { name: l.providerName })} icon={IconEmail} external={false} />
    ) : undefined;

  const read = reading?.listing ?? null;
  const outline = cn(buttonVariants({ variant: "outline" }), "rounded-full px-5");

  return (
    <div className="max-w-6xl">
      {/* A phone keeps the first screen for the providers: the sentence waits at the foot of the list, and in each listing. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} />

      <DataState
        loading={list.loading}
        error={listings.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant="card" rows={5} className="md:max-w-3xl" />}
      >
        {listings.length === 0 ? (
          <EmptyState icon={<IconServices aria-hidden />} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <div className="flex flex-col gap-3">
            <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
            <ChipRow items={chips} value={category} onChange={setCategory} label={t.filter} />

            {shown.length === 0 ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.emptyFiltered}
                action={
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-full px-5"
                    onClick={() => {
                      setSearch("");
                      setCategory("all");
                    }}
                  >
                    {t.clearAll}
                  </Button>
                }
              />
            ) : (
              <ul aria-label={t.listLabel} className="grid gap-2.5 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
                {shown.map((listing) => {
                  const title = titleOf(listing);
                  return (
                    <li key={listing.id} className="min-w-0">
                      <ListRowCard
                        className="h-full items-start"
                        leading={
                          <span data-slot="service-logo" className="flex size-full items-center justify-center bg-primary-soft text-primary">
                            {listing.providerLogoUrl ? (
                              <img src={listing.providerLogoUrl} alt="" loading="lazy" className="size-full object-cover" />
                            ) : (
                              <IconServices className="size-5" aria-hidden />
                            )}
                          </span>
                        }
                        title={<span dir="auto">{title}</span>}
                        amount={priceOf(listing) ?? <span className="text-xs font-normal text-ink-soft">{t.quote}</span>}
                        status={<StatusBadge value={listing.category} tone="info" text={t[`cat_${listing.category}`]} />}
                        meta={
                          <>
                            <bdi>{listing.providerName}</bdi>
                            {listing.priceUnit && listing.priceAmount !== null && (
                              <>
                                {" · "}
                                <bdi>{listing.priceUnit}</bdi>
                              </>
                            )}
                          </>
                        }
                        action={actionOf(listing)}
                        footer={
                          <p dir="auto" className="line-clamp-2 basis-full text-[13px] leading-5 text-ink-soft md:line-clamp-3">
                            {descriptionOf(listing)}
                          </p>
                        }
                        onOpen={() => setReading({ listing, open: true })}
                        openLabel={fmt(t.open, { title })}
                        aria-haspopup="dialog"
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-[13px] leading-5 text-ink-soft md:hidden">{t.description}</p>
          </div>
        )}
      </DataState>

      {read && (
        <Sheet
          open={Boolean(reading?.open)}
          onOpenChange={(open) => setReading((current) => (current ? { ...current, open } : current))}
          side="auto-end"
          title={<span dir="auto">{titleOf(read)}</span>}
          description={
            <>
              <bdi>{read.providerName}</bdi> · {t[`cat_${read.category}`]}
            </>
          }
          footer={
            read.contactWhatsapp || read.contactUrl || read.contactEmail ? (
              <>
                {read.contactEmail && (
                  <a href={`mailto:${read.contactEmail}`} data-slot="button" data-variant="outline" className={outline}>
                    <IconEmail className="size-4" aria-hidden />
                    {t.email}
                  </a>
                )}
                {read.contactUrl && (
                  <a href={read.contactUrl} target="_blank" rel="noopener noreferrer" data-slot="button" data-variant="outline" className={outline}>
                    <IconExternal className="size-4" aria-hidden />
                    {t.website}
                  </a>
                )}
                {read.contactWhatsapp && (
                  <a
                    href={whatsappHref(read)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-slot="button"
                    data-variant="default"
                    className={cn(buttonVariants(), "rounded-full px-5")}
                  >
                    <IconWhatsApp className="size-4" aria-hidden />
                    {t.whatsapp}
                  </a>
                )}
              </>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span data-slot="service-logo" className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.875rem] bg-primary-soft text-primary">
                {read.providerLogoUrl ? <img src={read.providerLogoUrl} alt="" className="size-full object-cover" /> : <IconServices className="size-6" aria-hidden />}
              </span>
              <div className="min-w-0">
                <p className="text-xs leading-4 font-medium text-ink-soft">{t.price}</p>
                <p className="text-[17px] leading-6 font-semibold text-ink tabular-nums">
                  {read.priceAmount !== null && read.priceCurrency ? (
                    <>
                      {priceOf(read)}
                      {read.priceUnit && (
                        <span className="text-sm font-normal text-ink-soft">
                          {" · "}
                          <bdi>{read.priceUnit}</bdi>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[15px] font-normal text-ink-soft">{t.quote}</span>
                  )}
                </p>
              </div>
            </div>
            <p dir="auto" className="text-sm leading-6 whitespace-pre-line text-ink">
              {descriptionOf(read)}
            </p>
            <p className="text-xs leading-5 text-ink-soft">{t.description}</p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
