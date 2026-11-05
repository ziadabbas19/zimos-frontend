import { afterEach, describe, expect, it } from "vitest";
import { setActiveLocale } from "@/i18n/activeLocale";
import { ApiError, getErrorMessage } from "./errors";

afterEach(() => setActiveLocale("en"));

const refusal = new ApiError("Missing required platform permission: agents.manage", 403, "FORBIDDEN");
const taken = new ApiError("The code SPRING is already taken.", 409, "REFERRAL_CODE_TAKEN");
const other = new ApiError("Plan not found", 404, "NOT_FOUND");

describe("getErrorMessage in English", () => {
  it("gives the server's message, and the fixed sentences as they were", () => {
    expect(getErrorMessage(refusal)).toBe("Missing required platform permission: agents.manage");
    expect(getErrorMessage(taken)).toBe("The code SPRING is already taken.");
    expect(getErrorMessage(new ApiError("", 403))).toBe("You don't have permission to do that.");
    expect(getErrorMessage(new ApiError("anything", 0))).toBe("Can't reach the server. Check your connection and try again.");
    expect(getErrorMessage(new TypeError("Failed to fetch"))).toBe("Can't reach the server. Check your connection and try again.");
    expect(getErrorMessage("not an error")).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage("not an error", "Could not save.")).toBe("Could not save.");
  });
});

describe("getErrorMessage in Arabic", () => {
  it("reads the codes it knows in Arabic, and a plain refusal as no permission", () => {
    setActiveLocale("ar");
    expect(getErrorMessage(taken)).toBe("هذا الكود مستخدم بالفعل.");
    expect(getErrorMessage(refusal)).toBe("ليست لديك صلاحية للقيام بذلك.");
    expect(getErrorMessage(new ApiError("", 403))).toBe("ليست لديك صلاحية للقيام بذلك.");
    expect(getErrorMessage(new ApiError("anything", 0))).toBe("تعذّر الوصول إلى الخادم. تحقق من اتصالك وحاول مرة أخرى.");
    expect(getErrorMessage("not an error")).toBe("حدث خطأ ما. يرجى المحاولة مرة أخرى.");
  });

  it("keeps the server's words for a code it doesn't know", () => {
    setActiveLocale("ar");
    expect(getErrorMessage(other)).toBe("Plan not found");
    expect(getErrorMessage(new ApiError("Odd", 409, "constructor"))).toBe("Odd");
  });
});
