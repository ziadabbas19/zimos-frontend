import type { ReferralSchedulePayment } from "@store-builder/api-client";
import { formatMinorMoney } from "@/lib/format";
import { useT } from "@/i18n/LocaleContext";
import { REFERRAL_CODE_STRINGS } from "./referralCodeStrings";

/**
 * A code's first payments, before and after (the code preview's `schedule`):
 * the payments it changes and the first one back at the full price.
 */
export function ScheduleTable({ rows, currency }: { rows: ReferralSchedulePayment[]; currency: string }) {
  const rt = useT(REFERRAL_CODE_STRINGS);
  const lastOff = rows.reduce((n, r, i) => (r.discount > 0 ? i : n), -1);
  const shown = rows.slice(0, Math.min(rows.length, Math.max(lastOff + 2, 1)));
  return (
    <table className="w-full text-xs text-ink-soft">
      <thead>
        <tr>
          <th className="text-start font-medium">{rt.payment}</th>
          <th className="text-end font-medium">{rt.discount}</th>
          <th className="text-end font-medium">{rt.youPay}</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={r.paymentNo}>
            <td>{r.paymentNo}</td>
            <td className="text-end tabular-nums">{r.discount > 0 ? formatMinorMoney(r.discount, currency) : "—"}</td>
            <td className="text-end tabular-nums text-ink">{formatMinorMoney(r.merchantPays, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
