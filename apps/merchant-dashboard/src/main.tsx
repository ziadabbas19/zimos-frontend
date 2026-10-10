import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@store-builder/ui/styles.css'
import './index.css'
// The theme: token values first, then the glass material of the shell and of the shared parts.
import './theme/tokens.css'
// The Black look and the tone of the Dark one, over the dark tokens.
import './theme/looks.css'
import './theme/liquid-glass.css'
import './theme/glass/menu.css'
import './theme/glass/dock.css'
import './theme/glass/controls.css'
import './theme/glass/states.css'
import './theme/glass/stats.css'
import './theme/glass/list.css'
import './theme/glass/sheet.css'
import './theme/glass/settings.css'
import './theme/glass/editor.css'
import './theme/glass/website.css'
import './theme/glass/funnel.css'
import './theme/glass/funnel-panes.css'
import './theme/glass/funnel-canvas.css'
import './theme/glass/funnel-list.css'
import './theme/glass/funnel-sheet.css'
import './theme/glass/sweep-account.css'
import './theme/glass/motion.css'
import './theme/view-transitions.css'
import './theme/shell.css'
import './theme/auth.css'
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
