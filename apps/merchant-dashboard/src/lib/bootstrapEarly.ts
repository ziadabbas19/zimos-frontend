// Imported first by main.tsx, so the frame's one request (lib/bootstrap) leaves
// before the rest of the app is even evaluated. A no-op when signed out or
// when no store was opened on this device yet.
import { startBootstrap } from "@/lib/bootstrap";

startBootstrap();
