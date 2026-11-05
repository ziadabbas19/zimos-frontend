import { describe, expect, it } from "vitest";
import type { ConsoleNotification, NotificationType } from "@/lib/notificationsApi";
import { NOTIFICATION_STRINGS, reviewDetail, reviewTitle, typeLabel } from "@/lib/notificationStrings";

const { en, ar } = NOTIFICATION_STRINGS;

const row = (type: NotificationType, data: Record<string, unknown>, body: string | null = null): ConsoleNotification => ({
  id: "n1",
  type,
  title: "English fallback",
  body,
  link: null,
  data,
  workspaceId: null,
  createdAt: "2026-11-05T00:00:00.000Z",
  readAt: null,
});

describe("a review's sentence", () => {
  it("names the code and who made it, in the viewer's language", () => {
    const n = row("referral_code_review", { code: "CAIRO-10", change: "new", actorName: "Mona" });
    expect(reviewTitle(en, n)).toBe("New code CAIRO-10 from Mona is waiting for review");
    expect(reviewTitle(ar, n)).toBe("الكود الجديد CAIRO-10 من Mona بانتظار المراجعة");
  });

  it("says when a reviewer edited a code before approving it", () => {
    const edited = row("referral_code_decided", { code: "CAIRO-10", change: "new", decision: "approved", edited: true, actorName: "Ziad" });
    expect(reviewTitle(en, edited)).toBe("Code CAIRO-10 was approved after Ziad edited it");
    expect(reviewTitle(ar, edited)).toContain("بعد تعديله من Ziad");
    const plain = row("referral_code_decided", { code: "CAIRO-10", change: "change", decision: "approved", edited: false, actorName: "Ziad" });
    expect(reviewTitle(en, plain)).toBe("The change to code CAIRO-10 was approved");
  });

  it("gives a rejection's reason on its own line", () => {
    const n = row("referral_code_decided", { code: "CAIRO-10", change: "new", decision: "rejected", edited: false }, "Too generous");
    expect(reviewTitle(en, n)).toBe("Code CAIRO-10 was rejected");
    expect(reviewDetail(en, n)).toBe("Reason: Too generous");
    expect(reviewDetail(ar, n)).toBe("السبب: Too generous");
  });

  it("names the store on a link request, for each kind of request and decision", () => {
    const data = { name: "Bakery", agentName: "Sara", actorName: "Mona" };
    expect(reviewTitle(en, row("agent_link_review", { ...data, kind: "link" }))).toBe("Mona asked to link Bakery to Sara");
    expect(reviewTitle(en, row("agent_link_review", { ...data, kind: "end" }))).toBe("Mona asked to end Sara's link on Bakery");
    expect(reviewTitle(en, row("agent_link_decided", { ...data, kind: "update", decision: "rejected" }))).toBe("The request to change Sara's link on Bakery was rejected");
    expect(reviewTitle(ar, row("agent_link_decided", { ...data, kind: "link", decision: "approved" }))).toBe("تمت الموافقة على طلب ربط Bakery بالوكيل Sara");
  });

  it("still reads when a name has gone", () => {
    expect(reviewTitle(en, row("agent_link_review", { kind: "link" }))).toBe("Someone asked to link a store to the agent");
  });

  it("leaves every other type to its label", () => {
    const n = row("support_ticket", {});
    expect(reviewTitle(en, n)).toBeNull();
    expect(typeLabel(en, n.type)).toBe("Support ticket");
  });
});
