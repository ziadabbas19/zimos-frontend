"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiErrorCode } from "@store-builder/api-client";
import { compressImageIfNeeded } from "@store-builder/image-tools";
import { useStoreBasePath } from "@/components/StoreRoute";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { useCartSheet } from "@/lib/cartSheet";
import { pickText } from "@/lib/i18n";
import { readPick, usePick } from "@/lib/pagePicks";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { getVisitorId } from "@/lib/visitorId";
import { btnSecondary, focusRing } from "../ui";

/**
 * The client halves of item 93's builder pieces (SPEC §9.3): the add-to-cart
 * and buy-now button, the price that follows the picked variant, and a page
 * form's photo and stars inputs. The variant a shopper picked on the page's
 * variant picker comes from lib/pagePicks.
 */

const TEXT = {
  en: { soldOut: "Sold out", adding: "Adding…", failed: "Couldn't add it — try again.", stars: (n: number) => `${n} out of 5` },
  ar: { soldOut: "نفدت الكمية", adding: "جارٍ الإضافة…", failed: "مقدرناش نضيفه — حاول تاني.", stars: (n: number) => `${n} من 5` },
  fr: { soldOut: "Épuisé", adding: "Ajout…", failed: "Impossible de l'ajouter — réessayez.", stars: (n: number) => `${n} sur 5` },
};

export interface ActionVariant {
  id: string;
  inStock: boolean;
}

/** The variant the button adds: the page's pick, else the one the merchant named, else the first in stock. */
function chosenVariant(variants: ActionVariant[], picked: string | null, preferred: string): ActionVariant | undefined {
  return (
    variants.find((v) => v.id === picked) ??
    variants.find((v) => v.id === preferred) ??
    variants.find((v) => v.inStock) ??
    variants[0]
  );
}

/** "Add to cart" (opens the cart) or "buy now" (adds, then goes to the checkout). */
export function CartActionButton({
  productId,
  variants,
  variantId,
  mode,
  label,
  className,
  editable,
  productHref = null,
}: {
  productId: string;
  variants: ActionVariant[];
  variantId: string;
  mode: "add_to_cart" | "buy_now";
  label: string;
  className: string;
  editable: boolean;
  /** Set when the product has options or fields to fill in first: the tap opens its page instead. */
  productHref?: string | null;
}) {
  const { addItem, openDrawer } = useCart();
  const { afterAdd } = useCartSheet(openDrawer);
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const router = useRouter();
  const basePath = useStoreBasePath();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => setPicked(readPick("variant", productId)), [productId]);
  usePick("variant", productId, useCallback((value: string) => setPicked(value), []));

  const variant = chosenVariant(variants, picked, variantId);
  const soldOut = !variant || !variant.inStock;

  async function run() {
    if (editable || busy || !variant || soldOut) return;
    if (productHref) {
      router.push(storeHref(basePath, productHref));
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await addItem(variant.id, undefined, 1);
      if (mode === "buy_now") router.push(storeHref(basePath, "/checkout"));
      else afterAdd();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-fit self-start">
      <button type="button" onClick={() => void run()} disabled={soldOut || busy} className={className}>
        {soldOut ? text.soldOut : busy ? text.adding : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {text.failed}
        </p>
      )}
    </div>
  );
}

export interface PriceTag {
  amount: number;
  price: string;
  compareAt: string | null;
}

/** The product's price, switched to the picked variant's whenever the shopper picks one on the page. */
export function PickedPrice({
  productId,
  initial,
  byVariant,
  currency,
  sizeClass,
}: {
  productId: string;
  initial: PriceTag;
  byVariant: Record<string, PriceTag>;
  currency: string;
  sizeClass: string;
}) {
  const [tag, setTag] = useState(initial);
  useEffect(() => {
    const picked = readPick("variant", productId);
    if (picked && byVariant[picked]) setTag(byVariant[picked]);
  }, [productId, byVariant]);
  usePick(
    "variant",
    productId,
    useCallback((value: string) => {
      if (byVariant[value]) setTag(byVariant[value]);
    }, [byVariant])
  );
  return (
    <p className="flex flex-wrap items-baseline gap-3" aria-live="polite">
      <span className={`font-bold text-ink ${sizeClass}`}>{tag.price}</span>
      {tag.compareAt && <span className="text-base text-ink-soft line-through">{tag.compareAt}</span>}
    </p>
  );
}

/** 1–5 stars as a radio group: arrow keys move, the pick is the value. */
export function StarsInput({ label, value, onChange, id }: { label: string; value: number; onChange: (n: number) => void; id: string }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-ink" id={`${id}-legend`}>
        {label}
      </legend>
      <div role="radiogroup" aria-labelledby={`${id}-legend`} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={text.stars(n)}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
                const forward = (e.key === "ArrowRight") !== rtl;
                const next = Math.min(5, Math.max(1, (value || 1) + (forward ? 1 : -1)));
                onChange(next);
                (e.currentTarget.parentElement?.children[next - 1] as HTMLElement | undefined)?.focus();
              }
            }}
            className={`flex size-10 cursor-pointer items-center justify-center rounded-lg text-2xl ${focusRing} ${n <= value ? "text-primary" : "text-line"}`}
          >
            <span aria-hidden>★</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const RAW_LIMIT = 15 * 1024 * 1024;
const COMPRESS = { maxBytes: 4 * 1024 * 1024, maxEdgeSteps: [2400, 2000, 1600, 1200], qualitySteps: [0.85, 0.75, 0.65] };

type PhotoState = { status: "idle" } | { status: "uploading"; preview: string } | { status: "done"; preview: string; uploadId: string } | { status: "error"; message: string };

/**
 * One photo for a page form: shrunk in the browser when that helps, uploaded
 * at once like a custom-field photo (POST /store/:ws/uploads), and named by
 * its upload id when the form is sent (backend contacts/formFiles.js).
 */
export function FormPhotoInput({
  workspaceId,
  label,
  required,
  disabled,
  id,
  onChange,
}: {
  workspaceId: string;
  label: string;
  required: boolean;
  disabled?: boolean;
  id: string;
  onChange: (uploadId: string | null, uploading: boolean) => void;
}) {
  const { t } = useStore();
  const [state, setState] = useState<PhotoState>({ status: "idle" });
  const preview = useRef<string | null>(null);
  useEffect(() => () => {
    if (preview.current) URL.revokeObjectURL(preview.current);
  }, []);

  function message(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 413) return t.custom.tooLarge;
      if (err.status === 415) return t.custom.wrongType;
      if (err.status === 422) return t.custom.unreadable;
      if (err.status === 429) return apiErrorCode(err) === "TOO_MANY_PENDING_UPLOADS" ? t.custom.tooMany : t.custom.rateLimited;
    }
    return t.custom.failed;
  }

  function pick(file: File | undefined) {
    if (!file || disabled) return;
    const typeOk = ACCEPTED.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
    if (!typeOk) {
      setState({ status: "error", message: t.custom.wrongType });
      onChange(null, false);
      return;
    }
    if (preview.current) URL.revokeObjectURL(preview.current);
    const url = URL.createObjectURL(file);
    preview.current = url;
    setState({ status: "uploading", preview: url });
    onChange(null, true);
    void (async () => {
      try {
        const prepared = await compressImageIfNeeded(file, COMPRESS);
        if (prepared.size > RAW_LIMIT) throw new ApiError("too large", 413, "FILE_TOO_LARGE", null);
        const upload = await createStorefrontApiClient().uploadCustomerPhoto(workspaceId, prepared, { visitorId: getVisitorId(workspaceId) });
        setState({ status: "done", preview: url, uploadId: upload.uploadId });
        onChange(upload.uploadId, false);
      } catch (err) {
        setState({ status: "error", message: message(err) });
        onChange(null, false);
      }
    })();
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {"preview" in state && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.preview} alt={t.custom.photoPreview(label)} className="size-16 rounded-xl border border-line object-cover" />
        )}
        <label className={`${btnSecondary} ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          {state.status === "idle" || state.status === "error" ? t.custom.choosePhoto : t.custom.replacePhoto}
          <input
            id={id}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {state.status === "done" && (
          <button
            type="button"
            className="cursor-pointer text-sm text-ink-soft underline"
            onClick={() => {
              setState({ status: "idle" });
              onChange(null, false);
            }}
          >
            {t.custom.removePhoto}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-soft" aria-live="polite">
        {state.status === "uploading" ? t.custom.uploading : state.status === "done" ? t.custom.uploaded : state.status === "error" ? <span className="text-danger">{state.message}</span> : t.custom.photoHint}
      </p>
    </div>
  );
}
