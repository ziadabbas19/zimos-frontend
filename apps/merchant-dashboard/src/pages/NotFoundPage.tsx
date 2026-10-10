import { IconCompass, IconHome } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { EmptyState } from "@/components/EmptyState";
import { ViewLink } from "@/components/ViewLink";

const STRINGS = {
  en: {
    title: "This page isn't here",
    description: "There's nothing at this address. The link may be old or mistyped.",
    home: "Go to the home page",
  },
  ar: {
    title: "هذه الصفحة غير موجودة",
    description: "لا يوجد شيء على هذا العنوان. قد يكون الرابط قديمًا أو مكتوبًا بشكل خاطئ.",
    home: "الذهاب إلى الصفحة الرئيسية",
  },
} satisfies Messages;

/**
 * Any address no route matches, shown inside the dashboard layout: the side
 * menu, the dock and Spotlight are all still there, so the page itself only
 * says what happened and offers the one way on.
 */
export function NotFoundPage() {
  const t = useT(STRINGS);
  return (
    <EmptyState
      icon={<IconCompass aria-hidden />}
      title={t.title}
      description={t.description}
      action={
        <Button asChild className="rounded-full px-5">
          <ViewLink to="/">
            <IconHome className="size-4" aria-hidden />
            {t.home}
          </ViewLink>
        </Button>
      }
    />
  );
}
