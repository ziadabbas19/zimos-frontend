import { useSyncExternalStore } from "react";
import { ApiError, uiPreferencesGet, uiPreferencesSaveAppearance, type UiAppearance, type UiAppearanceInput } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { adoptAppearance, hasKeptAppearance, keptAppearance, onAppearanceEdit, parseHexColour, type KeptAppearance } from "@/lib/appearance";

/**
 * The look of the dashboard, kept on the account as well as on this device,
 * so it follows its owner from one device to another.
 *
 * This device stays the source of the first paint: lib/appearance.ts and the
 * script in index.html read localStorage exactly as before, and nothing here
 * runs until an account is signed in. Then, once for each sign-in:
 *
 *   - the account has a look and this device never agreed one with it: the
 *     account's is taken and kept here;
 *   - both have one: the one saved last wins (UPDATED_AT_KEY against the
 *     account's `updatedAt`);
 *   - only this device has one: it is saved to the account.
 *
 * From then on each choice made on this page is kept here at once, as always,
 * and saved to the account once it has rested for SAVE_DELAY_MS. A save that
 * fails says nothing: the next choice sends the whole look again, and so does
 * the next sign-in. An API without the endpoint (404), or one that cannot be
 * read, leaves the dashboard exactly as it was before this file: nothing is
 * sent and nothing more is kept. Signing out keeps everything on the device.
 */

/** When the look on this device was last saved to the account, or changed after that. */
export const UPDATED_AT_KEY = "zimos.appearanceUpdatedAt";
/** The account that time was agreed with: another account signing in here starts from its own look. */
export const ACCOUNT_KEY = "zimos.appearanceAccount";
/** How long a choice rests before it is saved: one request for a slider that is being dragged. */
export const SAVE_DELAY_MS = 800;

const FIELDS = ["look", "darkTone", "glass", "glowLeft", "glowRight", "glowIntensity"] as const;

// The account whose sign-in was last taken up on this page; null while signed out.
let startedFor: string | null = null;
// The account being followed, once its look was read; null before that, and where the API has no such endpoint.
let following: string | null = null;
// Counts sign-ins and sign-outs: an answer that comes back for an earlier one is dropped.
let session = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
// The sign-in a save is on its way for; a choice made meanwhile waits for it and is sent after.
let sendingFor: number | null = null;
let waiting = false;
// Counts the choices made on this page, to tell whether one came while a save was on its way.
let edits = 0;
// The look as it was last seen here: choosing the same thing again is not a change.
let seen = "";
let saved = false;
const savedListeners = new Set<() => void>();

function setSaved(next: boolean) {
  if (saved === next) return;
  saved = next;
  savedListeners.forEach((fn) => fn());
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Site data is blocked: the account's look is taken again on the next visit.
  }
}

/** When the look here was last agreed with this account; null when it never was. */
function keptAt(userId: string): number | null {
  if (readKey(ACCOUNT_KEY) !== userId) return null;
  const at = Date.parse(readKey(UPDATED_AT_KEY) ?? "");
  return Number.isFinite(at) ? at : null;
}

function agree(userId: string, updatedAt: string | null) {
  if (updatedAt) writeKey(UPDATED_AT_KEY, updatedAt);
  writeKey(ACCOUNT_KEY, userId);
}

function toAccount(kept: KeptAppearance): UiAppearanceInput {
  return {
    look: kept.look,
    darkTone: kept.tone,
    glass: kept.glass,
    glowLeft: kept.glowLeft,
    glowRight: kept.glowRight,
    glowIntensity: kept.glowIntensity,
  };
}

function percent(value: unknown, otherwise: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : otherwise;
}

/** The account's look as this device keeps one; a key the account does not hold stays as it is here. */
function fromAccount(theirs: UiAppearance, mine: KeptAppearance): KeptAppearance {
  return {
    look: theirs.look === "light" || theirs.look === "black" || theirs.look === "dark" ? theirs.look : null,
    tone: percent(theirs.darkTone, mine.tone),
    glass: typeof theirs.glass === "boolean" ? theirs.glass : mine.glass,
    glowLeft: parseHexColour(theirs.glowLeft),
    glowRight: parseHexColour(theirs.glowRight),
    glowIntensity: percent(theirs.glowIntensity, mine.glowIntensity),
  };
}

function sameLook(mine: UiAppearanceInput, theirs: UiAppearance): boolean {
  return FIELDS.every((field) => mine[field] === theirs[field]);
}

async function save(): Promise<void> {
  const userId = following;
  if (userId === null) return;
  const mine = session;
  if (sendingFor === mine) {
    waiting = true;
    return;
  }
  sendingFor = mine;
  const sent = edits;
  try {
    const answer = await uiPreferencesSaveAppearance(apiClient, toAccount(keptAppearance()));
    if (mine !== session) return;
    // A choice made while this one was on its way keeps its own, later, time: it is sent next.
    if (sent === edits) agree(userId, answer?.appearance?.updatedAt ?? null);
    setSaved(true);
  } catch (err) {
    if (mine !== session) return;
    setSaved(false);
    // The API has no such endpoint: nothing more is sent until the next sign-in.
    if (err instanceof ApiError && err.status === 404) following = null;
  } finally {
    if (sendingFor === mine) sendingFor = null;
    if (waiting && mine === session) {
      waiting = false;
      void save();
    }
  }
}

// A choice made on this page: kept on the device already (lib/appearance), now on its way to the account.
onAppearanceEdit(() => {
  if (following === null) return;
  const now = JSON.stringify(keptAppearance());
  if (now === seen) return;
  seen = now;
  edits += 1;
  // Never earlier than the time last agreed with the account, whatever this device's clock says:
  // a choice made here after that save is the newer one.
  const agreed = Date.parse(readKey(UPDATED_AT_KEY) ?? "");
  const at = Math.max(Date.now(), Number.isFinite(agreed) ? agreed + 1 : 0);
  writeKey(UPDATED_AT_KEY, new Date(at).toISOString());
  writeKey(ACCOUNT_KEY, following);
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void save();
  }, SAVE_DELAY_MS);
});

/**
 * Called when an account is signed in on this page (components/AppearanceSync):
 * reads the look kept on it and settles it with the one on this device. Once
 * for each sign-in; resolves when the account's look was read.
 */
export async function startAppearanceSync(userId: string): Promise<void> {
  if (startedFor === userId) return;
  stopAppearanceSync();
  startedFor = userId;
  const mine = session;
  const before = JSON.stringify(keptAppearance());

  let theirs: UiAppearance | null;
  try {
    theirs = (await uiPreferencesGet(apiClient))?.appearance ?? null;
  } catch {
    // No such endpoint yet, or it cannot be read now: the dashboard goes on as it always did. The next sign-in asks again.
    return;
  }
  if (mine !== session) return;

  following = userId;
  const kept = keptAppearance();
  seen = JSON.stringify(kept);

  if (!theirs) {
    if (hasKeptAppearance()) void save();
    return;
  }

  const here = keptAt(userId);
  const there = Date.parse(theirs.updatedAt ?? "") || 0;
  // A choice made on this page while the account was being read is the newest there is.
  const choseMeanwhile = seen !== before;
  if (!choseMeanwhile && (here === null || there > here)) {
    adoptAppearance(fromAccount(theirs, kept));
    seen = JSON.stringify(keptAppearance());
    agree(userId, theirs.updatedAt);
    setSaved(true);
  } else if (choseMeanwhile || here === null || there < here || !sameLook(toAccount(kept), theirs)) {
    // The same time with another look: it was changed here while signed out.
    void save();
  } else {
    setSaved(true);
  }
}

/** Called on sign-out. The look kept on this device stays as it is; a choice not saved yet goes with the next sign-in. */
export function stopAppearanceSync() {
  session += 1;
  startedFor = null;
  following = null;
  waiting = false;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  setSaved(false);
}

function subscribeSaved(onStoreChange: () => void): () => void {
  savedListeners.add(onStoreChange);
  return () => {
    savedListeners.delete(onStoreChange);
  };
}

/** True while the last save to the account, or the last read of it, left this device and the account with one look. */
export function useAppearanceSaved(): boolean {
  return useSyncExternalStore(
    subscribeSaved,
    () => saved,
    () => false
  );
}
