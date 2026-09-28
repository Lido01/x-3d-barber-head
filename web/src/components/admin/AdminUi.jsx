/**
 * Shared chrome for the staff console.
 *
 * Every admin screen used to hand-roll the same eyebrow / title /
 * description / refresh-button header and the same scrollable row of
 * filter pills. Duplicated five times, that markup drifted, and none of
 * it was built for a 360px phone.
 *
 * The rules these encode:
 *
 *   - The title block is full width on a phone, with the actions
 *     wrapping underneath on their own row. Side by side, a 4xl serif
 *     title and two buttons do not fit, and shrinking the type to make
 *     them fit is worse than wrapping.
 *   - Action buttons are 40px tall minimum and take a full row of their
 *     own on the narrowest screens.
 *   - Filter pills scroll horizontally rather than wrapping, so the
 *     row height never jumps as counts change.
 *   - Content sits above the bottom tab bar, so the last card in a list
 *     is never trapped underneath it.
 */

import Alert from "../ui/Alert";
import Spinner from "../ui/Spinner";

/** Page title block. `actions` render below the text on a phone. */
export function AdminPageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
            {eyebrow}
          </p>
        )}

        <h1 className="mt-3 font-serif text-3xl leading-none text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>

        {description && (
          <p className="mt-3 text-xs leading-5 text-white/40">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Neutral pill button used for header actions. */
export function AdminButton({
  children,
  onClick,
  icon: Icon,
  tone = "neutral",
  disabled = false,
  type = "button",
  className = "",
}) {
  const tones = {
    neutral:
      "border-white/15 text-white/70 hover:border-[#d6a85f]/50 hover:text-white",
    primary: "bg-[#d6a85f] text-black hover:bg-[#e5bd7a]",
    danger:
      "border-[#e05a4f]/40 text-[#e0776b] hover:bg-[#e05a4f]/10",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]} ${className}`}
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  );
}

/** A bordered panel. The one surface every admin card is built on. */
export function AdminPanel({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#111] p-4 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/** Centred loading state, sized to the panel it replaces. */
export function AdminLoading({ label }) {
  return (
    <div className="mt-8 flex items-center justify-center rounded-2xl border border-white/10 bg-[#111] py-16">
      <Spinner label={label} />
    </div>
  );
}

/**
 * Horizontally scrollable filter pills with counts.
 *
 * `options` is [{ key, label, count }]. The row is a scroll container
 * with `no-scrollbar`, so on a narrow phone the pills stay on one line
 * and can be swiped instead of wrapping into a block that pushes the
 * list off screen.
 */
export function AdminFilterTabs({ options, value, onChange }) {
  return (
    <div
      role="tablist"
      className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
    >
      {options.map((option) => {
        const active = value === option.key;

        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-xs transition ${
              active
                ? "border-[#d6a85f] bg-[#d6a85f] font-semibold text-black"
                : "border-white/10 text-white/50 hover:border-white/40 hover:text-white/80"
            }`}
          >
            {option.label}
            <span
              className={
                active ? "text-black/60" : "text-white/30"
              }
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Centred empty state for a filtered list. */
export function AdminEmpty({ title, body, onRetry }) {
  return (
    <Alert
      tone="info"
      title={title}
      onRetry={onRetry}
      className="mt-8"
    >
      {body}
    </Alert>
  );
}
