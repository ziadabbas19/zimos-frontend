import { ListSkeleton as SharedListSkeleton, type ListSkeletonProps as SharedListSkeletonProps } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { loading: "Loading…" },
  ar: { loading: "جارٍ التحميل…" },
} satisfies Messages;

export type ListSkeletonProps = Omit<SharedListSkeletonProps, "label">;

/**
 * A list while its first page loads: the one skeleton for every table and
 * list (@store-builder/ui, shared with the console), announced in the
 * dashboard's language. Placeholders in the shape of the rows and exactly as
 * tall, so nothing jumps when they arrive — `ListRowCard`s on a phone, a
 * table-like sheet from md.
 */
export function ListSkeleton(props: ListSkeletonProps) {
  const t = useT(STRINGS);
  return <SharedListSkeleton {...props} label={t.loading} />;
}
