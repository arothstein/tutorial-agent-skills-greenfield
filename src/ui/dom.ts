/**
 * The one way this app builds DOM.
 *
 * Elements are constructed, never assembled from HTML strings. Every piece of
 * text on the page comes from `localStorage` or an imported file — the two
 * places data arrives from outside — and a template literal would make an
 * `innerHTML` assignment the natural way to render it. Text nodes cannot be
 * markup, so the injection is not defended against here; it is unavailable.
 */

/** A child: an element, or text to append as a text node. */
export type Child = Node | string;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>> = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }

  element.append(...children);

  return element;
}

/** Text only a screen reader reads: a label the visual design carries already. */
export function srOnly(text: string): HTMLSpanElement {
  return el('span', { class: 'sr-only' }, [text]);
}
