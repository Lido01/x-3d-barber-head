# Navigation and scrolling

## The problem

react-router changes the URL and swaps the rendered tree. It does **not** touch
the scroll position. Without help, a visitor who scrolls halfway down the
gallery and clicks "Services" arrives halfway down the services page, with no
indication they missed the top.

## What was added

`web/src/components/ScrollToTop.jsx` (mounted at the top of `Shell` in
`App.jsx`) plus the rules it calls in `web/src/utils/scroll.js`.

| Navigation | Result |
| --- | --- |
| `/gallery` → `/services` | animates to the top |
| `/services` → `/` | animates to the top |
| anywhere → `/#about` | animates to the `#about` section |
| `/` → `/#about` (hash-only change) | animates to `#about` |
| section not yet mounted | retried on the next animation frame, never falls back to the top |

The rules are plain functions in `utils/scroll.js` with no React in them, so
they can be tested directly rather than only through a rendered tree.

## Three details that matter

**Reduced motion wins.** `prefers-reduced-motion: reduce` switches every
animated scroll to an instant jump. This is not optional — the check runs
first and there is no way for a component to opt past it.

**A hash never falls back to the top.** If someone clicks a link to `/#about`
and the section has not mounted on the first frame, the code retries on the
next frame. It does *not* scroll to the top as a fallback: being dumped at the
top of the page when you asked for a specific section is a worse answer than
landing a frame late.

**Focus follows the navigation.** After a real page change, focus moves to
`<main id="main-content">` with `preventScroll: true`. Without this, a keyboard
or screen-reader user is still focused on the nav link they pressed, and their
next Tab walks back through the navigation instead of into the new content.
`tabIndex={-1}` keeps it out of the tab order, and `index.css` suppresses its
focus ring since it is only ever focused programmatically.

## Anchor clearance

The header is `position: fixed` and 78px tall, so a section reached by hash
would park its top edge underneath it. `index.css` gives every scroll target
`scroll-margin-top: 96px`:

```css
section[id],
.scroll-target {
  scroll-margin-top: 96px;
}
```

`section[id]` covers `about`, `gallery`, `guests` and `find-us`. Use the
`.scroll-target` class for a hash target that is not a `<section>`.

If you add a hash link, make sure the target id exists — a dangling `#id`
silently does nothing.

## Note on the mobile bottom bar

`BottomBar` is fixed to the bottom of the viewport and hides/shows on scroll
direction. It does not affect `scroll-margin-top`, so nothing extra is needed
for it, but it does mean the last section needs bottom padding on small
screens — `App.jsx` already puts `pb-20` on `<main>` for that.

The staff console has its own fixed bottom tab bar, which is always visible
rather than scroll-reactive — a barber tapping through payments mid-shift
should not have the bar slide away. `AdminLayout` handles the clearance with
`pb-28`; see [`small-device-layout.md`](small-device-layout.md).
