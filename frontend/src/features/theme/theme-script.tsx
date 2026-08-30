const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("mstina-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

/**
 * Inline, render-blocking script placed in <head> so the manual theme choice
 * applies before first paint — otherwise a returning dark-mode visitor would
 * see a flash of the light theme while React hydrates.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
