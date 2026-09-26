/**
 * Catalogue parity check.
 *
 * A missing key in a translated catalogue does not throw — `translate()` falls
 * back to English by design. That is the right behaviour at runtime, but it
 * means a typo quietly ships an English string inside an Amharic page. This
 * script turns that into a build failure.
 *
 * Run with: npm run check:i18n
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_LANGUAGE, LANGUAGES } from "../src/i18n/languages.js";

const here = dirname(fileURLToPath(import.meta.url));
const translationsDir = join(here, "..", "src", "i18n", "translations");

/**
 * The catalogues are plain object literals behind a single `export default`,
 * so evaluating them directly is enough and keeps the script dependency-free.
 *
 * The parens matter: without them the newline before the literal makes ASI
 * treat it as the body of a `return` and then parse it as a block statement.
 */
function loadCatalogue(file) {
  const source = readFileSync(file, "utf8").replace(/export\s+default\s+/, "");

  // eslint-disable-next-line no-new-func
  return new Function(`return (${source.trim().replace(/;$/, "")})`)();
}

function flattenKeys(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return value && typeof value === "object"
      ? flattenKeys(value, path)
      : [path];
  });
}

const files = readdirSync(translationsDir).filter((name) => name.endsWith(".js"));
const catalogues = new Map(
  files.map((name) => [name.replace(/\.js$/, ""), loadCatalogue(join(translationsDir, name))])
);

const reference = catalogues.get(DEFAULT_LANGUAGE);

if (!reference) {
  console.error(`No ${DEFAULT_LANGUAGE}.js found in ${translationsDir}`);
  process.exit(1);
}

const referenceKeys = flattenKeys(reference);
let failures = 0;

for (const language of LANGUAGES) {
  const catalogue = catalogues.get(language.code);

  if (!catalogue) {
    console.error(`FAIL  ${language.code}: no catalogue file`);
    failures += 1;
    continue;
  }

  if (language.code === DEFAULT_LANGUAGE) {
    continue;
  }

  const keys = new Set(flattenKeys(catalogue));
  const missing = referenceKeys.filter((key) => !keys.has(key));
  const extra = referenceKeys.length ? flattenKeys(catalogue).filter((key) => !referenceKeys.includes(key)) : [];

  if (missing.length) {
    console.error(`FAIL  ${language.code}: ${missing.length} missing key(s)`);
    missing.forEach((key) => console.error(`        ${key}`));
    failures += 1;
  }

  if (extra.length) {
    console.error(`FAIL  ${language.code}: ${extra.length} key(s) not in ${DEFAULT_LANGUAGE}.js`);
    extra.forEach((key) => console.error(`        ${key}`));
    failures += 1;
  }

  if (!missing.length && !extra.length) {
    console.log(`ok    ${language.code} (${keys.size} keys)`);
  }
}

// The provider is what imports this, so a bad barrel export should fail here
// rather than at runtime in the browser.
const { getTranslatedQuote, translatedTestimonials } = await import(
  "../src/i18n/translatedTestimonials.js"
);

for (const [english, entry] of Object.entries(translatedTestimonials)) {
  for (const language of LANGUAGES) {
    if (language.code === DEFAULT_LANGUAGE) {
      continue;
    }

    if (!entry[language.code]) {
      console.error(`FAIL  review "${english.slice(0, 40)}..." has no ${language.code} translation`);
      failures += 1;
    }
  }

  if (getTranslatedQuote(english, DEFAULT_LANGUAGE) !== null) {
    console.error(`FAIL  ${DEFAULT_LANGUAGE} reviews must return null and use the API text`);
    failures += 1;
  }
}

if (failures) {
  console.error(`\n${failures} i18n problem(s) found.`);
  process.exit(1);
}

console.log(`\nAll catalogues in sync (${referenceKeys.length} keys, ${Object.keys(translatedTestimonials).length} reviews).`);
