/**
 * Flags className strings that produce no CSS at all.
 *
 *   "overflow-hiddenpx-5"            instead of   "overflow-hidden px-5"
 *   "justify-centerrounded-full"     instead of   "justify-center rounded-full"
 *
 * This is not hypothetical. A bulk edit dropped the `rounded-*` classes
 * from around sixty elements; restoring them with a script reintroduced
 * the same mistake in a new form, and one join lost both the section's
 * `overflow-hidden` and its horizontal padding - so its contents ran
 * edge to edge and a blurred background glow pushed the page wider than
 * the viewport.
 *
 * Nothing else in the toolchain notices. A glued class is not a syntax
 * error, so the file parses, the linter is silent, the build succeeds,
 * and Tailwind quietly never emits the rule. The element simply loses
 * its styling, which is why this check exists.
 *
 * The test is empirical rather than a guess: read the class names out of
 * the compiled stylesheet and report any literal className token that
 * Tailwind did not generate. That is exactly the definition of the bug,
 * and it stays correct as Tailwind changes rather than encoding today's
 * idea of what a class name looks like.
 *
 * Run by `npm run check:classes`, which needs a build first.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = "src";
const DIST = "dist/assets";

const SCAN = /\.(jsx|js|ts|tsx)$/;
const SKIP = new Set(["node_modules", "dist", ".git"]);

/**
 * Decode a CSS class selector back into the name as written in source.
 *
 * Tailwind escapes the characters that are special in a selector, so
 * `.md\:grid-cols-2` is `md:grid-cols-2` and `.w-\[42px\]` is `w-[42px]`.
 */
function unescape(selector) {
  return selector.replace(/\\(.)/g, "$1");
}

/** Every class name the compiled stylesheet actually defines. */
function generatedClasses() {
  if (!existsSync(DIST)) {
    console.error(
      `\nNo stylesheet found in ${DIST}. Run "npm run build" first.\n`
    );
    process.exit(1);
  }

  const names = new Set();

  /*
   * A class selector is `.` followed by characters legal in a class name
   * once escaped. Commas are allowed because the only ones that appear
   * are inside arbitrary values - `bg-[rgb(0,0,0)]` - and Tailwind
   * escapes those to `\,`, which the `\\.` branch matches first. A bare
   * comma between two selectors is left to the minifier to split on,
   * and lands outside the run.
   */
  const SELECTOR = /\.((?:\\.|[^\s{},;>+~])+)/g;

  for (const file of readdirSync(DIST)) {
    if (!file.endsWith(".css")) continue;

    const css = readFileSync(join(DIST, file), "utf8");

    for (const match of css.matchAll(SELECTOR)) {
      const raw = match[1];

      /*
       * Two kinds of colon appear in a class selector and they mean
       * different things:
       *
       *   .hover\:bg-x:hover   the `:` inside is escaped, and belongs to
       *                       the class name
       *   the trailing `:hover` is bare, and is a pseudo-class - not
       *                       part of the name
       *
       * So park the escaped ones on a placeholder that cannot occur in
       * CSS, cut at the first bare colon, then put them back.
       */
      // A NUL cannot appear in a stylesheet, so it is a safe parking
      // spot for the escaped variant separators.
      const parked = raw.replace(/\\:/g, "\u0000");
      const name = unescape(parked.split(":")[0]).replace(/\u0000/g, ":");

      if (name.length > 1) {
        names.add(name);
      }
    }
  }

  return names;
}

/**
 * Whether a token can legitimately be absent from the stylesheet.
 *
 * Interpolated and conditional values are not written literally in
 * source, so they are never scanned; these are the cases where a
 * literal token still legitimately produces no rule of its own.
 */
function isNotAUtility(token) {
  // A value the caller passed in, e.g. className={className}.
  if (token.includes("$") || token.includes("{")) return true;

  // `group`/`peer` markers and `dark:`-style custom variants the
  // project does not use, plus the state prefixes that only take effect
  // under a parent class Tailwind cannot verify on its own.
  if (/^(group|peer|dark)$/.test(token)) return true;

  // A variant used only in combination, e.g. `group-hover:` on its own.
  if (/^[a-z-]+:$/.test(token)) return true;

  return false;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;

    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (SCAN.test(entry)) {
      yield full;
    }
  }
}

/**
 * Literal class strings on a line.
 *
 * Only the static parts of a template literal are read: everything from
 * the first `${` on is conditional and is not a class name in the source.
 */
function literalClassValues(line) {
  const values = [];

  for (const match of line.matchAll(/className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const raw = match[1] ?? match[2] ?? "";

    values.push(raw.split("${")[0]);
  }

  return values;
}

const generated = generatedClasses();
const problems = [];
let scanned = 0;
let checked = 0;

for (const file of walk(SRC)) {
  scanned++;

  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const value of literalClassValues(line)) {
        for (const token of value.split(/\s+/).filter(Boolean)) {
          if (isNotAUtility(token)) continue;

          checked++;

          if (!generated.has(token)) {
            problems.push({
              file: relative(".", file),
              line: index + 1,
              token,
            });
          }
        }
      }
    });
}

if (problems.length > 0) {
  const byFile = new Map();

  for (const problem of problems) {
    if (!byFile.has(problem.file)) byFile.set(problem.file, []);
    byFile.get(problem.file).push(problem);
  }

  console.error(
    `\n${problems.length} class name(s) generate no CSS (in ${byFile.size} file(s)):\n`
  );

  for (const [file, items] of byFile) {
    console.error(`  ${file}`);

    for (const item of items) {
      console.error(`    ${item.line}: "${item.token}"`);
    }
  }

  console.error(
    "\nEach of these is either a typo or two Tailwind classes run together" +
      " with no space between them. Tailwind emits no rule for a name it" +
      " does not recognise, so the element silently loses its styling.\n"
  );

  process.exit(1);
}

console.log(
  `ok  class names (${scanned} files, ${checked} utilities all generated)`
);
