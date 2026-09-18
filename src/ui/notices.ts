/**
 * Storage problems, said out loud on the page.
 *
 * Every row of SPEC's "Integrity and failure handling" table ends up here. The
 * rule behind all of them: the app stays usable, and the user is told what
 * happened in words that name the next move — never a console message they will
 * never see, and never a dead page.
 */

import type { SaveFailure, StoreStatus } from '../storage/localStore';
import { el, type Child } from './dom';

type Tone = 'warning' | 'error';

function notice(tone: Tone, heading: string, body: readonly Child[]): HTMLElement {
  return el('div', { class: `notice notice--${tone}`, 'data-notice': tone }, [
    el('strong', { class: 'notice__heading' }, [heading]),
    el('p', { class: 'notice__body' }, body),
  ]);
}

/** Where a quarantined value went, and how to get back to it. */
function quarantineSentence(quarantineKey: string | null): string {
  if (quarantineKey === null) {
    return (
      'It could not be copied to a safe key either, so nothing will be saved this ' +
      'session rather than risk writing over it. The original is still there.'
    );
  }

  return (
    `The original is untouched under the key ${quarantineKey}, and a backup file ` +
    'can restore it. A fresh, empty tracker is below.'
  );
}

/** The banner for how the session's state was loaded, if it needs one. */
function statusNotice(status: StoreStatus): HTMLElement | null {
  switch (status.kind) {
    case 'stored':
    case 'first-run':
      return null;

    case 'unavailable':
      return notice('warning', "Changes won't be saved on this device.", [
        'This browser would not let the app use local storage, so today\'s marks last ' +
          'only until the tab closes. Everything else works.',
      ]);

    case 'corrupt':
      return notice('warning', "The saved data couldn't be read.", [
        quarantineSentence(status.quarantineKey),
        el('span', { class: 'notice__detail' }, [` (${status.reason})`]),
      ]);

    case 'unsupported-version':
      return notice('warning', 'The saved data is from an older version of this app.', [
        `It is version ${status.storedVersion}, and there is no upgrade path to the ` +
          'version this build reads. ' +
          quarantineSentence(status.quarantineKey),
      ]);

    case 'future-version':
      return notice('warning', 'The saved data is from a newer version of this app.', [
        `It is version ${status.storedVersion}. Reading it would mean guessing at ` +
          "fields this build does not know, so it is left alone and changes won't be " +
          'saved. Open the newer version, or restore from a backup.',
      ]);
  }
}

/**
 * The banner for a write that did not happen.
 *
 * `read-only` is deliberately silent: the status banner above already explains
 * why nothing is being saved, and a second banner repeating it on every click
 * would be noise the user learns to ignore.
 */
function saveNotice(failure: SaveFailure): HTMLElement | null {
  switch (failure.kind) {
    case 'read-only':
      return null;

    case 'quota':
      return notice('error', "That change wasn't saved: the browser is out of space.", [
        'Nothing has been lost from this session — what is on screen is still correct. ' +
          'Clearing space for this site, or un-marking a day, lets the next save through.',
      ]);

    case 'unavailable':
      return notice('error', "That change wasn't saved.", [
        `The browser rejected the write (${failure.detail}). What is on screen is still ` +
          'correct, but it will not survive a reload.',
      ]);
  }
}

/** Every banner the current state calls for, in the order they should read. */
export function notices(status: StoreStatus, saveFailure: SaveFailure | null): HTMLElement[] {
  return [statusNotice(status), saveFailure ? saveNotice(saveFailure) : null].filter(
    (banner): banner is HTMLElement => banner !== null,
  );
}

/** The same failure, as one sentence for the live region. */
export function saveFailureSentence(failure: SaveFailure): string {
  switch (failure.kind) {
    case 'read-only':
      return '';

    case 'quota':
      return 'Not saved: the browser is out of space.';

    case 'unavailable':
      return 'Not saved: the browser rejected the write.';
  }
}
