import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "./theme-cookie";

/**
 * Run in <head> before the first paint ([locale]/layout.tsx): the theme class
 * on <html> from the stored choice, else the device's, so no frame shows the
 * wrong theme.
 *
 * A stored choice is also written to the cookie the dashboard's sign-in
 * screens read, the same line as themeCookie() in lib/theme-cookie.ts: a
 * choice made before there was a cookie reaches them from the next visit on,
 * and every visit renews it for another year.
 */
export const themeScript = `(function(){try{var e=document.documentElement,s=null;try{s=localStorage.getItem("theme")}catch(_){}var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";if(s==="light"||s==="dark"){var h=location.hostname.toLowerCase();document.cookie="${THEME_COOKIE}="+s+"; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax"+(h==="zimos.co"||h.slice(-9)===".zimos.co"?"; Domain=.zimos.co":"")+(location.protocol==="https:"?"; Secure":"")}}catch(_){}})();`;
