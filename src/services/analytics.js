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
