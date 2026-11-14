import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@store-builder/ui/styles.css'
import './index.css'
// Tajawal, Plus Jakarta Sans and Fraunces, served with the app (they came from Google Fonts):
// the dashboard's own file.
import '@store-builder/ui/fonts.css'
// The merchant dashboard's theme, in the dashboard's own order (its main.tsx):
// token values first, then the looks, then the glass material of the shell and
// of the shared parts. theme.test.mjs holds the two lists together.
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
import '@store-builder/ui/theme/glass/sweep-account.css'
import '@store-builder/ui/theme/glass/motion.css'
import '@store-builder/ui/theme/shell.css'
import '@store-builder/ui/theme/auth.css'
// The look kept on this device: a choice from before the three looks ("theme") is carried over on any page, the sign-in one too.
import '@store-builder/ui/appearance'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
