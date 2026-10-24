/*
 * Bangkok time (UTC+7, where Sira lives) for the desktop: the menu bar clock,
 * the terminal and Spotlight. The island keeps the same clock
 * (jungle/timeOfDay.js), and his routine there (jungle/utils/siraDay.js)
 * says what he's up to.
 */
import { isNapTime, isSleepTime } from '../components/jungle/utils/siraDay';

export const BANGKOK_ZONE = 'Asia/Bangkok';

const format = (options) => new Intl.DateTimeFormat('en-GB', { timeZone: BANGKOK_ZONE, ...options });
const CLOCK = format({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY = format({ weekday: 'short', day: 'numeric', month: 'short' });
const FULL = format({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** "19:32" in Bangkok. */
export const bangkokClock = (date = new Date()) => CLOCK.format(date);

/** "Sat 24 Oct" in Bangkok. */
export const bangkokDay = (date = new Date()) => DAY.format(date);

/** "Sat 24 Oct 2026 19:32:10" in Bangkok. */
export const bangkokDateTime = (date = new Date()) => FULL.format(date).replace(/,/g, '');

/** The hour in Bangkok, with minutes as a fraction (0–24). */
export const bangkokHour = (date = new Date()) => ((date.getUTCHours() + 7) % 24) + date.getUTCMinutes() / 60;

/** The visitor's own clock, or null if they're on Bangkok time too. */
export const visitorClock = (date = new Date()) => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (date.getTimezoneOffset() === -7 * 60) return null;
  return {
    time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date),
    zone: zone ? zone.split('/').pop().replace(/_/g, ' ') : 'Your time',
  };
};

/** What Sira is up to at camp now: his island routine (siraDay.js). */
export const siraStatus = (hour = bangkokHour()) => {
  if (isSleepTime(hour)) return { text: 'Asleep in the tent', emoji: '🌙' };
  if (isNapTime(hour)) return { text: 'Napping in the camp chair until 15:30', emoji: '😴' };
  if (hour < 18.5) return { text: 'Up and about at camp', emoji: '☀️' };
  return { text: 'Hanging out by the campfire', emoji: '🔥' };
};
