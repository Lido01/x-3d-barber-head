# Language support

The public storefront can be read in **English**, **አማርኛ (Amharic)** and
**Afaan Oromoo**. A visitor picks a language from the header (desktop), the
"+ More" sheet (mobile) or the footer.

## What is translated, and what is not

Translated:

- header and bottom app bar
- hero
- About
- quick book steps
- the home gallery band
- testimonials, including the review form and the sign-in prompt in
  place of it
- the customer account screens — sign in, register, and the list of your
  own reviews
- the featured guest wall
- the "find us" map and directions
- footer
- the seeded guest reviews themselves

Deliberately **not** translated: the booking flow, the payment screens, and
the staff console at `/admin`. Those are the screens where a mistranslated
label can cost someone money or send them to the wrong slot. English is
better than a half-finished Amharic payment screen. If you extend the
translation, extend it here too — don't drift.

### Why the account screens are translated

They sit on the storefront, and a visitor reaches them by tapping "sign
in to review" in their own language. Translating the *explanation* of why
a sign-in is being asked for is the whole point: in English it reads as a
reasonable request, in the wrong language it reads as an unexplained wall.


## How it works

```
src/i18n/
  languages.js              registry: code, native name, direction, beta flag
  translations/en.js        reference catalogue — every key must exist here
  translations/am.js        Amharic
  translations/om.js        Afaan Oromoo
  dictionaries.js           resolve a dot path, interpolate {placeholders}
  languageStorage.js        read/write the choice, detect from navigator
  LanguageContext.jsx       provider + useLanguage() / useTranslate()
  translatedTestimonials.js per-review translations
```

`translate()` resolves a key in the active locale and falls back to English if
it is missing, then to the key itself if it is missing there too. That is
graceful at runtime and bad for catching typos, which is what
`npm run check:i18n` is for.

Adding a string:

1. Add it to `translations/en.js`.
2. Add it to `am.js` and `om.js`.
3. Run `npm run check:i18n` — it fails on a missing or extra key.

## Guest reviews

Reviews are free text typed by customers, so the backend has no locale field
and the API returns exactly what was submitted. `translatedTestimonials.js`
keys translations off the **English source string** created by
`manage.py seed_demo_content`.

- A review with a matching key shows the translation as the headline, with the
  guest's original English underneath in a quieter style and a language tag.
- A review with no matching key (a real new submission) shows the original
  English. That is the honest result — we do not invent a translation.

If you change the seed copy, update the keys in `translatedTestimonials.js` in
the same commit or the reviews silently fall back to English.

Reviews are now tied to a customer account, but that does not add a locale:
the account has no language field, and the guest's own words are still what
get translated. See [`customer-accounts.md`](customer-accounts.md).

## Afaan Oromoo is marked beta

`languages.js` sets `beta: true` for `om`, and the switcher renders a small
Beta tag. The catalogue is a real translation, not a placeholder, but it has
not been reviewed by a native speaker yet. Remove the flag once it has.

## Fonts

`DM Serif Display` and `Manrope` carry no Ethiopic coverage. `index.css` puts
`Noto Serif Ethiopic` and `Noto Sans Ethiopic` in the stacks so Amharic renders
in the brand's type instead of an OS fallback. Afaan Oromoo is Latin script and
needs nothing extra. If you add a language with another script, extend the
stacks and check the headline clamp — Amharic needed a smaller one in the hero
because the words are longer.

## Not in git

`.gitignore` at the repo root keeps generated and binary assets out of
history: `backend/media/`, `backend/seed_assets/`, `web/public/` (which holds
the ~32 MB `head_sculp.glb` barber head) and `web/src/assets/`. Fetch or
author those locally.
