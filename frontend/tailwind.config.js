/**
 * Tailwind CSS v4 uses a CSS-first configuration.
 *
 * ⚠️ Design tokens are NOT defined here anymore — they live in
 *    `src/tailwind.css` inside the `@theme { … }` block (the v4 source of truth).
 *    Add/edit colors, radius, shadow and fonts THERE, not in this file.
 *
 * This file is kept only so tooling that still probes for `tailwind.config.js`
 * resolves `content` paths. It is not loaded for theme values unless the CSS
 * explicitly opts in with `@config`.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
};
