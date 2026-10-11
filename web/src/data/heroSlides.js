/**
 * The hero's background images.
 *
 * ## Changing this is the whole job
 *
 * To change the landing page's backgrounds, edit this array. Nothing else
 * needs to know an image exists - `sections/Hero.jsx` renders one layer
 * per entry, animates between them, and builds the dots, so adding a
 * fourth photo is one line here rather than a component change.
 *
 *   image  a path under `/media/` on the Django server. Resolved through
 *          `mediaUrl`, so the LAN-address rewrite in services/api.js still
 *          applies and a phone opened over the shop's wifi does not get
 *          loopback URLs back.
 *   focus  the CSS `background-position`. Use it when a portrait shot
 *          would otherwise be cropped through the face: `"50% 30%"` moves
 *          the frame up towards the eyes.
 *
 * A single entry is valid. The rotation, the dots and the crossfade all
 * stand down on their own rather than leaving dead controls on the page.
 *
 * `dark` is optional per slide, for a photo bright enough that the
 * headline would not hold contrast against it. It strengthens the
 * overlay for that slide only.
 */

export const HERO_SLIDES = [
  {
    image: "/media/gallery/demo-golden-hour.jpg",
    focus: "50% 40%",
  },
  {
    image: "/media/services/demo-skin-fade.jpg",
    focus: "50% 35%",
  },
  {
    image: "/media/gallery/demo-quiet-luxury.jpg",
    focus: "50% 45%",
  },
  {
    image: "/media/gallery/demo-clean-lines.jpg",
    focus: "50% 35%",
    dark: true,
  },
];

/** How long a slide holds before the next one fades in, in milliseconds. */
export const HERO_ROTATE_MS = 7000;

/** How long one crossfade takes. Short enough to feel like a dissolve. */
export const HERO_FADE_MS = 1600;