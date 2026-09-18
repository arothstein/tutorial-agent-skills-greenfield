/**
 * Entry point.
 *
 * Task 9 replaces this with the real storage -> state -> render wiring. For now
 * it exists so `pnpm run build` exercises the whole TypeScript pipeline rather
 * than bundling an empty page.
 */
const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.textContent = 'Habits';
}
