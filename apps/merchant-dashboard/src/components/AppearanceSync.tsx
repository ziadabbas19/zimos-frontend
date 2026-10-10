import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { startAppearanceSync, stopAppearanceSync } from "@/lib/appearanceSync";

/**
 * Follows the signed-in account's look: taken up when an account is signed in
 * on this page, let go when it signs out (lib/appearanceSync). Draws nothing.
 * While the account is still being read, or could not be, nothing changes.
 */
export function AppearanceSync() {
  const { status, user } = useAuth();
  const userId = status === "authenticated" && user ? user.id : null;

  useEffect(() => {
    if (userId) void startAppearanceSync(userId);
    else if (status === "guest") stopAppearanceSync();
  }, [userId, status]);

  return null;
}
