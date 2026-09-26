# Featured guests and the location map

Two additions to the public storefront, and one thing to read before you edit
either of them.

## Read this first: the guest personas are fictional

`web/src/data/featuredGuests.js` contains six invented Ethiopian personas —
names, handles, fields and quotes are all made up. The portraits in
`web/src/portraits/` are illustrations drawn for this project. **No real
person is depicted, named or quoted, and none of these are real
endorsements.**

This is not over-caution. Putting invented words in the mouth of a real,
identifiable person — an Ethiopian artist, musician or creator — is
defamation, and it is a regulatory problem for the shop, not a marketing
shortcut. The same applies to lifting someone's photo without a written
release.

The section renders with a visible `guests.sampleNotice` line saying the
personas are fictional. **Leave that line in place until the content is real.**

To make a persona real you need all three of:

1. the guest agrees to be listed, in writing;
2. a photo you are licensed to publish (or shoot one in-house with consent);
3. the quote is theirs and they have approved it.

Then swap `portrait` for the published image URL, replace the copy, and
delete the `sampleNotice` key from all three catalogues. The component does
not care where the image comes from.

## Portraits

Six hand-authored SVGs, ~3 KB each, in `web/src/portraits/`. They are text, so
they are tracked in git (unlike the photography in `backend/seed_assets/`,
which is ignored) and they stay sharp at any size. Vite inlines them as
`data:` URIs, so six portraits cost zero extra network requests.

Skin tones and hair are varied on purpose — the guests should not all look
alike.

## Location and map

`web/src/data/studioLocation.js` is the single source of truth for the
address, coordinates and map bounds. Before, the footer said "Bole Road,
Addis Ababa" and the About band said "5th Floor, Posta, Adama" — they
disagreed. Everything reads from the one file now, so fixing the address is a
one-line change.

**The coordinates are a placeholder.** Drop a real pin, confirm the floor and
building, and correct the landmark list before this goes live. A map that
sends someone to the wrong block is worse than no map. The `approxMinutes` on
each landmark are deliberately vague — they answer "how far", and real
distances come from the directions link.

### Why OpenStreetMap for the map, Google for the directions

`openStreetMapEmbedUrl()` returns a plain
`openstreetmap.org/export/embed.html` iframe. No API key, no billing account,
no console project, so it cannot break when a key expires or a quota is hit.
The iframe is CSS-filtered to a dark basemap to match the site.

Routing is different: Google Maps is what people in Addis actually use, so
`directionsUrl(travelmode)` is the primary button, with walk / transit /
drive modes. The OSM link sits beside it. OSM map data is ODbL-licensed, so
the attribution line is rendered — keep it.

## Checking your work

```
cd web
npm run verify        # lint + i18n parity + production build
npm run check:i18n    # catalogues match, every review has all translations
```
