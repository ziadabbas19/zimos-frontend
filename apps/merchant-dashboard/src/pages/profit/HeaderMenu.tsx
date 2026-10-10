import { Fragment } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@store-builder/ui";
import { IconMoreActions, IconSpinner, type IconComponent } from "@/components/icons";
import { useLocale } from "@/i18n/LocaleContext";
import { useViewNavigate } from "@/lib/viewTransition";

export interface HeaderMenuItem {
  id: string;
  label: string;
  /** A second, quieter line: what is behind the row. */
  hint?: string;
  icon: IconComponent;
  /** A dashboard route the row opens… */
  to?: string;
  /** …or something done in place. */
  onSelect?: () => void;
  disabled?: boolean;
  /** Draws a hairline over the row: the start of another group. */
  separatorBefore?: boolean;
}

/** A menu line: 40px with a mouse, 44px under a finger; rounded to sit inside the corners of the menu. */
const ITEM = "min-h-10 cursor-pointer items-start gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11";
const GLYPH = "mt-0.5 size-[18px] text-ink-soft";

/**
 * «…» at the end of a page header: what is used rarely and so is not on the
 * page — the way to a neighbouring screen, a refresh, an import. One round
 * button, 44px under a thumb; the menu hangs from its end edge.
 *
 * The button is the dashboard's outline button, so the glass layer gives it
 * its small pane without a rule of its own.
 */
export function HeaderMenu({ label, items, busy = false }: { label: string; items: ReadonlyArray<HeaderMenuItem>; busy?: boolean }) {
  const { dir } = useLocale();
  const navigate = useViewNavigate();
  if (items.length === 0) return null;

  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="outline" aria-label={label} title={label} className="size-11 shrink-0 rounded-full p-0 pointer-fine:size-10" />}
        >
          {busy ? (
            <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <IconMoreActions className="size-5" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-60 rounded-[1.125rem] p-1.5">
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            const to = item.to;
            return (
              <Fragment key={item.id}>
                {item.separatorBefore && index > 0 && <DropdownMenuSeparator className="mx-2 my-1" />}
                <DropdownMenuItem
                  className={ITEM}
                  disabled={item.disabled}
                  onClick={() => {
                    if (to) navigate(to);
                    else item.onSelect?.();
                  }}
                >
                  <ItemIcon className={GLYPH} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.label}</span>
                    {item.hint && <span className="mt-0.5 block text-xs leading-4 text-ink-soft">{item.hint}</span>}
                  </span>
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}
