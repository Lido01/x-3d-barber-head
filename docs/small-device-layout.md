# Small-device layout

The site and the staff console are both used on a phone. A barber
confirming a payment or cancelling a no-show is standing at a counter
with one hand, and most customers book from a phone rather than a
laptop. Nothing below is decoration: each rule exists because a specific
thing broke without it.

The target is **360px wide** (iPhone SE, Galaxy S8, the narrow end of
every Android phone) up to a 430px phone, then a tablet, then a
desktop. Tailwind's default breakpoints apply, so `sm` is 640px, `lg` is
1024px. The storefront switches desktop/mobile at `lg`; the admin console
keeps its sidebar at `lg` too.

## Touch targets

Anything tappable is at least **40px tall**, and anything in a form is at
least **44px**. On a phone a 32px row is a coin toss between two
neighbours, which for a destructive action means a mis-tap.

- `components/admin/AdminUi.jsx` → `AdminButton` is `min-h-10` (40px) with
  `px-4 py-2.5`.
- `components/account/authStyles.js` → `INPUT` and `PRIMARY_BUTTON` are
  `py-3.5`/`py-4` on a `text-base` (16px) control, which clears 44px.
- `AdminLayout` nav links and drawer buttons are `min-h-11` (44px).

## iOS zooms on focus

iOS Safari zooms the whole page when a focused input is under 16px, and
the zoom does not reset when the field blurs. Every control that receives
typing is `text-base` on small screens for this reason, and
`index.css` has a backstop:

```css
input,
textarea,
select {
  font-size: max(16px, 1em);
}
```

If you add a form control, keep it at `text-base` below `sm` unless you
want the page to zoom on focus.

## Viewport height

`100vh` includes a mobile browser's collapsing URL bar. A `min-h-screen`
panel sized that way can put its submit button below the fold on first
paint. `index.css` exposes:

```css
:root { --viewport-height: 100vh; }

@supports (height: 100dvh) {
  :root { --viewport-height: 100dvh; }
}
```

The full-height screens — `AdminLogin`, `RequireCustomer`'s spinner,
`AuthShell`, `AdminLayout` — size against
`min-h-[var(--viewport-height)]`.

**Do not centre a tall form in the viewport.** `AdminLogin` used to be a
vertically centred `py-32` card; on a 667px-tall phone that pushed the
sign-in button below the fold. The account screens are top-aligned
scrolling columns instead.

## Not stacking a row of controls

The overflow cases that actually happened were flex rows of a file input
and a button, and a row of two filter pills:

- **File inputs** need `w-full min-w-0`. A native file picker refuses to
  shrink below its intrinsic width, and it is what pushed the row wider
  than the viewport.
- **Form rows** are single-column below `sm` and two-column from `sm`
  (`grid gap-4 sm:grid-cols-2`).
- **Filter pills** scroll horizontally inside a `no-scrollbar` container
  with `-mx-4 px-4` so the row bleeds to the screen edge and the first
  and last pill are not inset. Wrapping would make the row height jump
  as counts change.
- **Search boxes** are full width with the icon absolutely positioned and
  a clear button inside the right edge.

## The admin console

Three navigation surfaces, because a phone and a desktop want different
things:

| Width | Navigation |
| --- | --- |
| `>= lg` | fixed 256px sidebar, all six sections |
| `< lg` | sticky header with the current section + fixed bottom tab bar with all six sections |
| `< lg` | hamburger → bottom sheet with the account block, back-to-site and sign out |

The **bottom tab bar** is the reason a phone admin can work a shift:
moving between payments, bookings and reviews is one tap instead of
opening a menu first. It scrolls horizontally if the six labels do not
fit. The **drawer** deliberately holds only the two rare actions —
signing out is not a per-shift action, and putting it in the tab bar
would cost a section a slot.

Content carries `pb-28` on a phone so the last card in a list is not
trapped under the tab bar. `AdminLayout` handles this once; pages should
not add their own.

The drawer locks body scroll, closes on Escape, and closes on route
change. Focus moves to the close button and returns to the trigger.

## Lists, not tables

No admin screen uses a `<table>`. A table cannot be made readable at
360px without either horizontal scrolling or a card layout, and a
horizontally scrolling table on a phone means the row's action buttons
are off screen when you are deciding whether to press one. Every list is
a stacked card with the metadata in a `<dl>` that is one column below
`sm` and three from `sm` up.

Cards use `break-words` on every text field. Customer names, notes and
transaction references are free text and a single long token will
otherwise widen the card and reintroduce horizontal scroll.

## Per-screen notes

**Overview** — stat cards are two per row at every width. The count is
`text-4xl` below `sm` so a four-figure number does not make one card
taller than its neighbour.

**Bookings** — status actions (Confirm / Complete / Cancel) and Delete
are on each card, enabled by status exactly as the server enforces them.
Search covers name, phone, service, barber and id. Destructive actions
keep a `window.confirm`, because a target under a thumb should not be one
stray tap from a delete.

**Payments** — the receipt is full width and tappable to open full size,
above the method and reference rows. It used to be a 96px thumbnail
beside a two-column grid, which left it around 100px wide on a 360px
screen, and deciding a payment means reading it.

**Services** — the add-style form is a stacked column, not the flex row
it was. Every control is `min-w-0`.

**Gallery** — the card grid starts at **one** column. Two cards at `sm`
left ~200px of image per card on a large phone, which is not enough to
tell whether a photo is a good one, and this is the one screen that is
genuinely visual. Action rows are pinned to the card bottom with
`mt-auto` so they line up across a row.

**Testimonials (admin)** — reviews written before accounts existed have
`user: null` and are marked *Legacy · name unverified*, so a moderator
judging whether to publish is not looking at a name that appears checked
when it is not.

**Admin login** — top-aligned column, 48px submit button, and it says
where customers sign in, so a staff member is not left looking for it.

## The review gate

Reading the review wall is public. Writing a review needs a customer
account, because a review is attributed to a real person: see
`api_endpoint.md` §6 and `docs/customer-accounts.md`.

`sections/Testimonials.jsx` shows a sign-in / register prompt in place of
the form when nobody is signed in, and while a stored token is being
revalidated it shows a spinner — otherwise it flashes the prompt at
someone who *is* signed in.
