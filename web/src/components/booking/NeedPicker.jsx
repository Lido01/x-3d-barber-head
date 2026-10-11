import { Sparkles, Scissors } from "lucide-react";

/**
 * "What are you after?" — the booking form's shortcut into the catalogue.
 *
 * ## The problem it solves
 *
 * The service `<select>` asks someone to know the shop's vocabulary before
 * they can answer it. Most customers arrive with a description, not a
 * product code: "I want something sharp", "just the beard", "keep my
 * length". Reading nine service names to work out which one that is makes
 * them do the shop's job.
 *
 * So the picker starts from their words and resolves them to the real
 * catalogue, and then gets out of the way. The chips are derived from
 * services the backend actually published, matched by keyword, so this
 * can never offer something the shop does not sell or invent a price for
 * it.
 *
 * ## Why a chip with no match is not rendered
 *
 * An intent that matches nothing would be a button that does nothing
 * visible. Worse than absent: it reads as "we do not do that". So the
 * list is built from the loaded services and a chip only exists when at
 * least one service matches it.
 */

/**
 * Intents, matched against the catalogue.
 *
 * Keywords are checked against a service's name, its description and the
 * names of its styles - a shop that sells "Tapered Low Fade" as a style
 * under another service should still be findable by typing "fade".
 *
 * **Order inside a list is the ranking.** The first keyword found is the
 * answer, so the specific phrases come before the broad words. Counting
 * how many keywords matched, which was the first version, gets this
 * exactly backwards: "Classic Cut" and "Signature Haircut" both match
 * twice, so tapping *Classic cut* landed the customer on Signature —
 * because the shop happened to publish a style called "Classic Side Part".
 * First-match ranking with "classic cut" above "classic" above
 * "signature" sends them to Classic Cut, which is what the chip says.
 *
 * Lists that match nothing are dropped entirely, so a chip can never be a
 * button that quietly does nothing.
 */
const INTENTS = [
  {
    key: "sharp",
    label: "Sharp & clean",
    keywords: ["skin fade", "high fade", "mid fade", "fade", "taper"],
  },
  {
    key: "beard",
    label: "Beard only",
    keywords: ["beard sculpt", "beard trim", "beard"],
  },
  {
    key: "classic",
    label: "Classic cut",
    keywords: ["classic cut", "classic side part", "signature haircut"],
  },
  {
    key: "keep",
    label: "Keep some length",
    keywords: ["textured", "crop", "side part"],
  },
  {
    key: "both",
    label: "Hair & beard",
    keywords: ["haircut + beard", "hair and beard", "full grooming"],
  },
];

/** Everything about a service a customer might describe it with. */
function searchable(service) {
  return [
    service.name,
    service.description,
    ...(service.styles || []).map((style) => style.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Which service best answers each intent.
 *
 * Score is the position of the first keyword the service matched, so
 * lower is a better answer and an unmatched service is simply absent.
 * Ties go to the shop's own order, because the catalogue is curated and
 * its first entry is the one the shop wants pushed.
 *
 * @returns {Array<{key: string, label: string, service: object}>}
 */
function resolveIntents(services) {
  // The haystack is built once per service rather than once per intent:
  // five intents over eight services is forty string joins on a form that
  // re-renders while the availability request is in flight.
  const haystacks = services.map(searchable);

  return INTENTS.map((intent) => {
    let best = null;
    let bestRank = Infinity;

    services.forEach((service, index) => {
      const rank = intent.keywords.findIndex((keyword) =>
        haystacks[index].includes(keyword)
      );

      if (rank !== -1 && rank < bestRank) {
        bestRank = rank;
        best = service;
      }
    });

    return { key: intent.key, label: intent.label, service: best };
  }).filter((entry) => entry.service);
}

const CHIP =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition";

/**
 * The intent row.
 *
 * `onPick(service)` is handed the whole service, so the caller runs the
 * same `handleSelectService` the `<select>` would - which is what clears
 * the stale time and the stale-slot message in one place rather than
 * having a second code path that forgets to.
 */
export function NeedPicker({ services, selectedId, onPick }) {
  const intents = resolveIntents(services || []);

  if (intents.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/35">
        <Sparkles size={11} className="text-[#d6a85f]" />
        What are you after?
      </p>

      {/*
        A horizontal scroller, deliberately *not* bleeded past the card's
        padding with negative margins.

        It looks nicer edge to edge, and it was tried. The row is a grid
        item's descendant, and a negative margin widens the box by its own
        amount inside every ancestor that measures content - which pushed
        the whole booking page to about three times a phone's width and let
        the customer scroll the storefront sideways. A scroller that stays
        inside its padding costs eight pixels of visual bleed and keeps the
        page the width of the screen.
      */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {intents.map((intent) => {
          const active = String(intent.service.id) === String(selectedId);

          return (
            <button
              key={intent.key}
              type="button"
              onClick={() => onPick(intent.service)}
              aria-pressed={active}
              className={`${CHIP} ${
                active
                  ? "border-[#d6a85f] bg-[#d6a85f] text-black"
                  : "border-white/12 bg-white/[0.03] text-white/60 hover:border-[#d6a85f]/60 hover:text-[#d6a85f]"
              }`}
            >
              {intent.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-5 text-white/30">
        Pick what fits and we will fill in the service. You can change it
        below.
      </p>
    </div>
  );
}

/**
 * The styles under the chosen service.
 *
 * The booking API books a *service*, not a style - there is no style on
 * the appointment and no slot arithmetic that knows about one. So the
 * choice is recorded as a note the barber reads at the chair, which is
 * where a preference like "high fade, not a low one" would otherwise be
 * lost.
 *
 * Shown only for a service that actually has styles; a service with none
 * renders nothing rather than an empty row.
 */
export function StylePicker({ service, selectedName, onSelect }) {
  const styles = (service?.styles || []).filter((style) => style.is_active !== false);

  if (styles.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/35">
        <Scissors size={11} className="text-[#d6a85f]" />
        Any style in mind?
      </p>

      <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onSelect("")}
          aria-pressed={!selectedName}
          className={`${CHIP} ${
            !selectedName
              ? "border-white/30 bg-white/10 text-white"
              : "border-white/12 text-white/50 hover:border-white/30 hover:text-white"
          }`}
        >
          No preference
        </button>

        {styles.map((style) => {
          const active = selectedName === style.name;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onSelect(active ? "" : style.name)}
              aria-pressed={active}
              className={`${CHIP} ${
                active
                  ? "border-[#d6a85f] bg-[#d6a85f] text-black"
                  : "border-white/12 bg-white/[0.03] text-white/60 hover:border-[#d6a85f]/60 hover:text-[#d6a85f]"
              }`}
            >
              {style.name}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-5 text-white/30">
        {selectedName
          ? `We will note "${selectedName}" for your barber.`
          : "We will note this on your booking for the barber to follow."}
      </p>
    </div>
  );
}