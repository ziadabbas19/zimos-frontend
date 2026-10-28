import { describe, expect, it } from "vitest";
import type { MerchantNotificationDto } from "@store-builder/api-client";
import { NOTIFICATION_STRINGS, notificationText, notificationTypeLabel, type NotificationStrings } from "./notificationText";

// The types that came with device notifications (the API's PUSH_ENABLED): named in
// My notifications, and read in the bell in the viewer's language.
const en = NOTIFICATION_STRINGS.en as NotificationStrings;
const ar = NOTIFICATION_STRINGS.ar as NotificationStrings;
const note = (type: string, data: Record<string, unknown> = {}) =>
  ({ id: "n1", type, title: "stored", body: "stored", link: null, data, readAt: null, createdAt: "2030-01-01T00:00:00Z" }) as unknown as MerchantNotificationDto;

describe("the types that came with device notifications", () => {
  it("are named in English and Arabic", () => {
    expect((["order.paid", "lost_order.new", "whatsapp.message"] as const).map((type) => notificationTypeLabel(en, type))).toEqual([
      "Paid orders (online or by transfer)",
      "New lost orders",
      "New WhatsApp messages",
    ]);
    expect(notificationTypeLabel(ar, "lost_order.new")).toBe("الطلبات المفقودة الجديدة");
    expect(notificationTypeLabel(ar, "whatsapp.message")).toBe("رسائل واتساب الجديدة");
  });

  it("a paid order and a lost order read in the viewer's language", () => {
    expect(notificationText(en, note("order.paid", { orderNumber: "1043", total: "450.00 EGP" }))).toEqual({ title: "Order 1043 was paid", body: "450.00 EGP" });
    expect(notificationText(ar, note("order.paid", { orderNumber: "1043", total: "450.00 EGP" })).title).toBe("تم دفع الطلب 1043");
    expect(notificationText(en, note("lost_order.new", { checkoutSessionId: "s1" })).title).toBe("A new lost order");
    expect(notificationText(ar, note("lost_order.new")).body).toMatch(/الطلبات المفقودة/);
  });
});
