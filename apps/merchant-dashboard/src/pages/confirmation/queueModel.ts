import {
  ORDER_SORTS,
  type ConfirmationOutcome,
  type ConfirmationQueueSort,
  type ConfirmationTask,
} from "@store-builder/api-client";
import { IconClock, IconFailed, IconNoAnswer, IconSuccess, type IconComponent } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { CONFIRM_ROLES, MANAGE_ROLES, minutesUntil } from "./confirmationRoles";

/**
 * What the queue knows about a task without asking the server: who may do
 * what, whether a task is workable now, and whose claim it is under. Shared by
 * the list view and the calling station, so both read a task the same way.
 */

export const OUTCOMES: ConfirmationOutcome[] = ["confirmed", "rejected", "unreachable", "postponed"];

/** Each outcome's icon (with the word, never the icon alone). */
export const OUTCOME_ICON: Record<ConfirmationOutcome, IconComponent> = {
  confirmed: IconSuccess,
  rejected: IconFailed,
  unreachable: IconNoAnswer,
  postponed: IconClock,
};

/** "Queue order" is each tab's own order (due callbacks first on Pending); the rest sort on the server. */
export const QUEUE_SORTS: readonly ConfirmationQueueSort[] = ["default", ...ORDER_SORTS];
export const SORT_STORAGE_KEY = "zimos.confirmation.sort";
export const PAGE_SIZE = 50;

/** The assignment filter: every task, mine, nobody's, or one agent's (their user id). */
export type AssignmentFilter = "all" | "me" | "unassigned" | (string & {});

/** The two ways the waiting tab is shown: one order at a time, or the list. */
export type QueueView = "station" | "list";
const VIEW_STORAGE_KEY = "zimos.confirmation.view";

export function readStoredView(): QueueView {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "station";
  } catch {
    return "station";
  }
}

export function storeView(view: QueueView): void {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Private tab or blocked storage: the choice lasts for this visit only.
  }
}

/** What the viewer may do here, from their role key in this workspace. */
export function useQueueAbilities() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role ?? "";
  return {
    userId: user?.id ?? null,
    canConfirm: CONFIRM_ROLES.has(role),
    canManage: MANAGE_ROLES.has(role),
  };
}

/** A funnel order still in its offer window: listed, not workable yet. */
export const isWaiting = (task: ConfirmationTask, now: number) =>
  task.status === "queued" && Boolean(task.availableAt) && new Date(task.availableAt as string).getTime() > now;

/** Paid by InstaPay or a wallet and not approved yet: the order cannot be confirmed (the server refuses too). */
export const awaitsPaymentApproval = (task: ConfirmationTask) =>
  Boolean(task.order.manualPayment) && task.order.manualPayment?.status !== "approved";

/** A booked callback whose time has not come yet. */
export const isBookedForLater = (task: ConfirmationTask, now: number) =>
  task.status === "queued" && Boolean(task.nextRetryAt) && new Date(task.nextRetryAt as string).getTime() > now;

export interface LockState {
  inProgress: boolean;
  /** The viewer holds the claim (live or lapsed). */
  mine: boolean;
  /** The claim's time ran out; the server hands the task back on its next read. */
  expired: boolean;
  minutesLeft: number;
}

export function lockStateOf(task: ConfirmationTask, userId: string | null, now: number): LockState {
  const inProgress = task.status === "in_progress";
  const minutesLeft = minutesUntil(task.lockExpiresAt, now);
  return {
    inProgress,
    mine: inProgress && task.lockedByUserId === userId,
    expired: inProgress && minutesLeft === 0,
    minutesLeft,
  };
}

/**
 * Whether the calling station may show this task to the viewer now: it is
 * due (no callback booked for later, its offers window closed), nobody else
 * is on it, and it is not handed to another agent — a manager may take those.
 * These are the same conditions under which the list offers its Claim button.
 */
export function isStationTask(task: ConfirmationTask, now: number, userId: string | null, canManage: boolean): boolean {
  if (task.status === "done") return false;
  const lock = lockStateOf(task, userId, now);
  // The call the viewer is on stays theirs until they save or let go of it.
  if (lock.mine) return true;
  if (lock.inProgress && !lock.expired) return false;
  if (isWaiting(task, now)) return false;
  if (task.status === "queued" && isBookedForLater(task, now)) return false;
  const assignedToOther = Boolean(task.assignedTo) && task.assignedTo?.id !== userId;
  if (assignedToOther && !canManage) return false;
  return true;
}

/**
 * The customer's number when it is whole. Some roles are sent it masked
 * (010****665): that is not a number to dial, so the station offers a call
 * only when this returns the number.
 */
export function dialablePhone(phone: string | null | undefined): string | null {
  const value = phone?.trim();
  if (!value) return null;
  if (/[*•×xX]/.test(value)) return null;
  return value.replace(/[^\d٠-٩۰-۹]/g, "").length >= 7 ? value : null;
}

/** `tel:` for a number: Arabic-Indic digits folded, spaces and dashes dropped. */
export function telHref(phone: string): string {
  const ascii = phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return `tel:${ascii.replace(/[^\d+]/g, "")}`;
}

/** An Egyptian mobile number in the groups people say it in (010 1234 5678); anything else as it was typed. */
export function readablePhone(phone: string): string {
  const digits = phone.trim();
  return /^01\d{9}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}` : phone;
}
