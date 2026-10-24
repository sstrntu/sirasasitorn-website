// Google Analytics (gtag.js). A file rather than an inline script, so the site's security
// policy can forbid inline scripts. The app sends a page view on every route change
// (src/services/analytics.js), so this first config doesn't send one as well.
window.dataLayer = window.dataLayer || [];
window.gtag = function gtag() {
  window.dataLayer.push(arguments);
};
window.gtag('js', new Date());
window.gtag('config', 'G-B8WVWBM978', { send_page_view: false });
