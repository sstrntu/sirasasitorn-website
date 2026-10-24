// Google Analytics tracking utilities

/**
 * Send a pageview event to Google Analytics
 * @param {string} path - The page path to track
 */
export const trackPageView = (path) => {
    if (typeof window.gtag === 'function') {
        window.gtag('config', 'G-B8WVWBM978', {
            page_path: path,
        });
    }
};

/**
 * Report an error to Google Analytics (an "exception" event), e.g. the 3D scene failing on a device.
 * @param {string} description - What went wrong (kept short; no personal data)
 * @param {boolean} fatal - Whether it stopped the page from working
 */
export const trackException = (description, fatal = false) => {
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'exception', { description: String(description).slice(0, 150), fatal });
    }
};

/**
 * Send a custom event to Google Analytics
 * @param {string} action - The event action
 * @param {string} category - The event category
 * @param {string} label - The event label
 * @param {number} value - The event value
 */
export const trackEvent = (action, category, label, value) => {
    if (typeof window.gtag === 'function') {
        window.gtag('event', action, {
            event_category: category,
            event_label: label,
            value: value,
        });
    }
};
