/*
 * Sira's day follows the visitor's local clock (the same hour the scene's
 * lighting uses, `?time=` override included): he sleeps in the tent at
 * night, naps in the camp chair after lunch, stays out of the water after
 * dark, and gets the fire going for breakfast and again in the evening.
 */

/** The current local hour (0–24), kept up to date by <Likeness />. */
export const day = { hour: 12 };

/** Asleep in the tent from 23:00 until 6:30. */
export const isSleepTime = (hour) => hour >= 23 || hour < 6.5;

/** After-lunch nap in the camp chair. */
export const isNapTime = (hour) => hour >= 13 && hour < 15.5;

/** Light enough to swim and paddle. */
export const isDaylight = (hour) => hour >= 7 && hour < 18.5;
