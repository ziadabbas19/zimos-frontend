// The frame's reads in one request, sent before anything else is evaluated (lib/bootstrap).
import './lib/bootstrapEarly'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@store-builder/ui/styles.css'
import './index.css'
// The theme: token values first, then the glass material of the shell and of the shared parts.
// The layers the platform console draws with too are in packages/ui/src/theme; the ones
// under ./theme are this dashboard's own screens.
import '@store-builder/ui/theme/tokens.css'
// The Black look and the tone of the Dark one, over the dark tokens.
import '@store-builder/ui/theme/looks.css'
import '@store-builder/ui/theme/liquid-glass.css'
import '@store-builder/ui/theme/glass/menu.css'
import '@store-builder/ui/theme/glass/dock.css'
import '@store-builder/ui/theme/glass/controls.css'
import '@store-builder/ui/theme/glass/states.css'
import '@store-builder/ui/theme/glass/stats.css'
import '@store-builder/ui/theme/glass/list.css'
import '@store-builder/ui/theme/glass/sheet.css'
import '@store-builder/ui/theme/glass/settings.css'
import './theme/glass/editor.css'
import './theme/glass/website.css'
import './theme/glass/funnel.css'
import './theme/glass/funnel-panes.css'
import './theme/glass/funnel-canvas.css'
import './theme/glass/funnel-list.css'
import './theme/glass/funnel-sheet.css'
import './theme/glass/offers.css'
import './theme/glass/recovery.css'
import './theme/glass/orders.css'
import './theme/glass/confirm.css'
import '@store-builder/ui/theme/glass/sweep-account.css'
import '@store-builder/ui/theme/glass/motion.css'
import './theme/view-transitions.css'
import '@store-builder/ui/theme/shell.css'
import '@store-builder/ui/theme/auth.css'
// The look kept on this device: a choice from before the three looks is carried over on any page, the sign-in ones too.
import './lib/appearance'
// Page chunks are fetched on hover / touch-start of a menu item (lib/prefetch.ts).
import './routes/prefetch'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
