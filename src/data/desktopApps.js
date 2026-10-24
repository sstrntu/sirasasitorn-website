/*
 * The desktop's apps and project links, shared by the dock, the desktop icons,
 * the menu bar and Spotlight. An app with `opens` opens that desktop window;
 * one with `url` opens the link outside the site.
 */
export const DOCK_APPS = [
  { id: 'messages', name: 'Messages', opens: 'messages', icon: 'https://raw.githubusercontent.com/lucasromerodb/liquid-glass-effect-macos/refs/heads/main/assets/messages.png' },
  { id: 'mail', name: 'Mail', url: 'mailto:sirasasitorn@gmail.com', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Mail_%28iOS%29.svg' },
  { id: 'notes', name: 'Notes', opens: 'notes', icon: 'https://icons.iconarchive.com/icons/hamzasaleem/stock-style-3/512/Notes-icon.png' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/siratu/', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://linkedin.com/in/sirasasitorn/', icon: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png' },
  { id: 'maps', name: 'Maps', opens: 'maps', icon: 'https://raw.githubusercontent.com/lucasromerodb/liquid-glass-effect-macos/refs/heads/main/assets/map.png' },
  { id: 'terminal', name: 'Terminal', opens: 'terminal', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Terminalicon2.png' },
];

export const RESUME_ICON = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';

/** Project sites with desktop icons; `desktop` / `mobile` place the icon (x measured from the right edge). */
export const DESKTOP_PROJECTS = [
  { name: 'Turfmapp', url: 'https://turfmapp.com', icon: '/turfmapp-icon.png', desktop: { right: 570, y: 120 }, mobile: { right: 70, y: 90 } },
  { name: 'ACSS', url: 'https://www.acsaensaep.co/', icon: '/acss-icon.png', desktop: { right: 250, y: 220 }, mobile: { right: 140, y: 150 } },
  { name: 'Groundwrk 10', url: 'https://www.groundwrk.io/', icon: '/groundwork10-icon.png', desktop: { right: 350, y: 200 }, mobile: { right: 70, y: 210 } },
];

/** Names of the desktop's windows, for the menu bar and Spotlight. */
export const WINDOW_NAMES = {
  terminal: 'Terminal',
  pdf: 'Preview',
  notes: 'Notes',
  messages: 'Messages',
  maps: 'Maps',
};

/** Opens an outside link the way the dock always has: mail in the mail app, sites in a new tab. */
export const openExternal = (url) => {
  if (url.startsWith('mailto:')) window.open(url, '_blank');
  else window.open(url, '_blank', 'noopener,noreferrer');
};
