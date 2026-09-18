/**
 * Entry point and composition root.
 *
 * The only module that touches the real environment: it reads the clock once,
 * finds the browser's storage, and hands both to `startApp`. Everything below
 * takes them as arguments, which is why the rest of the app can be tested
 * against a fixed Thursday and a storage that refuses to write.
 */

import { startApp } from './app';
import { toDateKey } from './domain/dates';
import { browserStorage } from './storage/localStore';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  // index.html ships with this element. Its absence is a broken build, not a
  // condition to recover from.
  throw new Error('#app is missing from the page');
}

startApp({
  // The one clock read in the app. `today` is a parameter everywhere below.
  //
  // Resolved at startup and not refreshed: a tab left open across midnight goes
  // on showing the day it was opened, and marking a habit would log that day.
  // Deliberate for now — the day boundary is only correct on load.
  today: toDateKey(new Date()),
  storage: browserStorage(),
  root,
});
