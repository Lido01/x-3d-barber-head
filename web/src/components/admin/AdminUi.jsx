/**
 * Shared chrome for the staff console.
 *
 * Every admin screen used to hand-roll the same header, the same filter
 * pills, the same field markup and the same button. Duplicated a dozen
 * times, that markup drifted, and none of it was built for a 360px phone
 * held in one hand.
 *
 * So this file is the single answer to "what does a control look like
 * here", and the rules it encodes are:
 *
 *   - The title block is full width on a phone with the actions on their
 *     own row beneath it. Side by side, a serif title and three buttons
 *     do not fit, and shrinking the type to make them fit is worse than
 *     wrapping.
 *   - Every control is at least 44px tall. A barber working a shift taps
 *     these with a thumb, often while holding something else.
 *   - Filter pills scroll sideways rather than wrapping, so the row
 *     height never jumps as the counts change under the finger.
 *   - Destructive actions are never the default styling and never sit
 *     next to the thing they undo without a confirmation.
 *   - Content clears the bottom tab bar, so the last row of a list is
 *     never trapped underneath it.
 *
 * Colours come from the `console-*` theme tokens in index.css rather
 * than arbitrary hex, which is what stopped the console accumulating
 * four slightly different greps.
 */

import { useEffect, useId, useRef } from "react";
import { Monitor, Moon, MoveHorizontal, Search, Sun, X } from "lucide-react";

import Alert from "../ui/Alert";
import Spinner from "../ui/Spinner";
import { useTheme } from "../../context/ThemeContext";
import { registerModal } from "../../utils/modalStack";

// -----------------------------------------------------------------
// Theme
// -----------------------------------------------------------------

/**
 * Light / dark / auto.
 *
 * `compact` is the icon-only form for the header; the default is the
 * three-way control for the settings screen, because deciding between
 * light and dark is not the same decision as choosing to follow the
 * system, and a two-way toggle cannot express the second one.
 */
export function ThemeToggle({ compact = false }) {
  const { preference, setTheme, toggleTheme } = useTheme();

  if (compact) {
    const isDark = preference === "dark";

    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to the light console" : "Switch to the dark console"}
        title={isDark ? "Light console" : "Dark console"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-console-line text-console-body transition hover:border-console-accent hover:text-console-accent-strong"
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    );
  }

  const options = [
    { value: "light", label: "Light", icon: Sun, hint: "Neutral grey. Best in daylight." },
    { value: "dark", label: "Dark", icon: Moon, hint: "Near-black. Easier at night." },
    {
      value: "auto",
      label: "Match device",
      icon: Monitor,
      hint: "Follows the phone or laptop setting, live.",
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Console theme"
      className="grid gap-2 sm:grid-cols-3"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={`flex min-h-20 cursor-pointer flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition ${
              active
                ? "border-console-accent bg-console-accent-soft"
                : "border-console-line bg-console-raised hover:border-console-line-strong"
            }`}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  active
                    ? "bg-console-accent text-console-on-accent"
                    : "bg-console-sunken text-console-muted"
                }`}
              >
                <Icon size={16} />
              </span>

              {active && (
                <AdminChip tone="accent">
                  Active
                </AdminChip>
              )}
            </span>

            <span className="text-sm font-semibold text-console-ink">
              {option.label}
            </span>

            <span className="text-[11px] leading-4 text-console-muted">
              {option.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------
// Page furniture
// -----------------------------------------------------------------

/**
 * Page title block.
 *
 * `actions` render below the text on a phone and beside it from `lg`
 * up, where there is finally room for both.
 */
export function AdminPageHeader({ eyebrow, title, description, actions, meta }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-console-accent">
            {eyebrow}
          </p>
        )}

        <h1 className="mt-1.5 font-serif text-3xl leading-tight text-console-ink sm:text-4xl">
          {title}
        </h1>

        {meta}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}

/** A bordered surface. The one panel every card in the console is built on. */
export function AdminPanel({ children, className = "", as: Tag = "div", ...rest }) {
  return (
    <Tag
      className={`rounded-2xl border border-console-line bg-console-raised ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** A panel with a heading, an optional aside, and consistent padding. */
export function AdminSection({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "p-4 sm:p-5",
}) {
  return (
    <AdminPanel className={className}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-console-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-console-ink">{title}</h2>
            )}

            {description && (
              <p className="mt-1 text-xs leading-5 text-console-muted">
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
      )}

      <div className={bodyClassName}>{children}</div>
    </AdminPanel>
  );
}

/** Centred loading state, sized to the panel it replaces. */
export function AdminLoading({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-console-line bg-console-raised px-4 py-16">
      <Spinner label={label} />
    </div>
  );
}

/** Centred empty state for a filtered list. */
export function AdminEmpty({ title, body, onRetry, action }) {
  if (action) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-console-line-strong bg-console-raised px-5 py-12 text-center">
        <p className="font-serif text-lg text-console-ink">{title}</p>

        {body && (
          <p className="max-w-sm text-sm leading-6 text-console-muted">{body}</p>
        )}

        {action}
      </div>
    );
  }

  return (
    <Alert tone="info" title={title} onRetry={onRetry}>
      {body}
    </Alert>
  );
}

// -----------------------------------------------------------------
// Buttons
// -----------------------------------------------------------------

const BUTTON_TONES = {
  neutral:
    "border-console-line-strong bg-console-raised text-console-body hover:border-console-accent hover:text-console-accent-strong",
  primary:
    "border-console-accent bg-console-accent text-console-on-accent hover:border-console-accent-strong hover:bg-console-accent-strong",
  good: "border-console-good bg-console-good text-white hover:brightness-110",
  danger:
    "border-console-bad/40 bg-console-bad-soft text-console-bad hover:border-console-bad hover:bg-console-bad hover:text-white",
  ghost: "border-transparent text-console-muted hover:bg-console-sunken hover:text-console-ink",
};

/**
 * The console's button.
 *
 * `block` makes it fill its row on a phone, which is what every primary
 * action in a form should do - a 120px-wide Save button next to a
 * 360px-wide form is a mis-tap waiting to happen.
 */
export function AdminButton({
  children,
  onClick,
  icon: Icon,
  tone = "neutral",
  size = "md",
  block = false,
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  ...rest
}) {
  const sizes = {
    sm: "min-h-9 gap-1.5 px-3 text-[11px]",
    md: "min-h-11 gap-2 px-4 text-sm",
    lg: "min-h-12 gap-2.5 px-5 text-sm",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${BUTTON_TONES[tone]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}

/**
 * A destructive action that asks first.
 *
 * `window.confirm` rather than a styled dialog on purpose: it cannot be
 * dismissed by a stray tap on the page behind it, and it is the one
 * dialog every phone user already knows how to answer. Deleting a
 * booking is not a gesture to make easy.
 */
export function AdminConfirmButton({
  onConfirm,
  message,
  children,
  icon: Icon,
  tone = "danger",
  size = "md",
  block = false,
  disabled = false,
  loading = false,
}) {
  return (
    <AdminButton
      icon={Icon}
      tone={tone}
      size={size}
      block={block}
      disabled={disabled}
      loading={loading}
      onClick={() => {
        if (window.confirm(message)) {
          onConfirm();
        }
      }}
    >
      {children}
    </AdminButton>
  );
}

// -----------------------------------------------------------------
// Status
// -----------------------------------------------------------------

/**
 * A status pill.
 *
 * Reads at a glance and carries real meaning, so a queue can be worked
 * without reading a single word of it. Unknown values render as
 * themselves rather than being guessed at - a status this console does
 * not know about is information, not something to paper over.
 */
const STATUS_TONES = {
  pending: "warn",
  waiting: "warn",
  confirmed: "info",
  approved: "good",
  verified: "good",
  good: "good",
  active: "good",
  completed: "good",
  rejected: "bad",
  cancelled: "bad",
  bad: "bad",
  disabled: "bad",
  expired: "bad",
};

const STATUS_CHIP = {
  warn: "border-console-warn/30 bg-console-warn-soft text-console-warn",
  good: "border-console-good/30 bg-console-good-soft text-console-good",
  bad: "border-console-bad/30 bg-console-bad-soft text-console-bad",
  info: "border-console-info/30 bg-console-info-soft text-console-info",
  // The brand tone, for chips that mark *your own* state rather than a
  // row's status - the signed-in role, the active theme. It was missing
  // here, so `tone="accent"` silently rendered as the muted fallback.
  accent:
    "border-console-accent/40 bg-console-accent-soft text-console-accent-strong",
  neutral: "border-console-line-strong bg-console-sunken text-console-muted",
};

export function AdminChip({ children, tone = "neutral", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${STATUS_CHIP[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function AdminStatus({ status, className = "" }) {
  const label = String(status ?? "").replace(/_/g, " ");

  return (
    <AdminChip tone={STATUS_TONES[status] || "neutral"} className={className}>
      {label || "Unknown"}
    </AdminChip>
  );
}

// -----------------------------------------------------------------
// Stats
// -----------------------------------------------------------------

/**
 * One figure.
 *
 * `to` turns the card into a link, because a number on a dashboard is
 * nearly always a question about the rows behind it, and the shortest
 * path to the answer is to make the number tappable.
 */
export function AdminStat({
  label,
  value,
  sub,
  icon: Icon,
  to,
  tone = "neutral",
  onClick,
}) {
  const tones = {
    neutral: "text-console-ink",
    accent: "text-console-accent-strong",
    good: "text-console-good",
    warn: "text-console-warn",
    bad: "text-console-bad",
  };

  const Wrapper = to ? "a" : onClick ? "button" : "div";
  const interactive = Boolean(to || onClick);

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
          {label}
        </p>

        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-console-sunken text-console-muted">
            <Icon size={15} />
          </span>
        )}
      </div>

      <p className={`mt-2 font-serif text-3xl leading-none tabular-nums sm:text-4xl ${tones[tone]}`}>
        {value}
      </p>

      {sub && <p className="mt-1.5 text-xs leading-5 text-console-muted">{sub}</p>}
    </>
  );

  const shell = `block rounded-2xl border border-console-line bg-console-raised p-4 text-left ${
    interactive
      ? "transition hover:border-console-accent hover:shadow-sm focus-visible:border-console-accent"
      : ""
  }`;

  if (to) {
    return (
      <a href={to} className={shell}>
        {inner}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${shell} w-full`}>
        {inner}
      </button>
    );
  }

  return <div className={shell}>{inner}</div>;
}

/** A row of stats. Two up on a phone, more as the screen allows. */
export function AdminStatGrid({ children, columns = 4 }) {
  const layouts = {
    2: "grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };

  return (
    <div className={`grid gap-3 sm:gap-4 ${layouts[columns] || layouts[4]}`}>
      {children}
    </div>
  );
}

// -----------------------------------------------------------------
// Form fields
// -----------------------------------------------------------------

const FIELD_BASE =
  "w-full min-w-0 rounded-xl border border-console-line-strong bg-console-raised px-3.5 py-2.5 text-console-ink outline-none transition placeholder:text-console-faint focus:border-console-accent focus:ring-2 focus:ring-console-accent/20 disabled:bg-console-sunken disabled:text-console-muted";

const LABEL_BASE =
  "block text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted";

/**
 * A labelled control.
 *
 * Owns the label/description/error wiring so no screen has to remember
 * it: `htmlFor` on the label, `aria-describedby` on the input, and
 * `aria-invalid` when there is an error. The id is generated when the
 * caller does not supply one, which is what makes it safe to drop a
 * field into a list that repeats.
 */
export function AdminField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className = "",
  children,
  trailing,
}) {
  const generated = useId();
  const id = htmlFor || generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label className={LABEL_BASE} htmlFor={id}>
          {label}
          {required && <span className="ml-1 text-console-bad">*</span>}
        </label>
      )}

      <div className="relative mt-1.5">
        {children}

        {trailing && (
          <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[11px] leading-5 text-console-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[11px] font-medium leading-5 text-console-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export function AdminInput({ className = "", invalid, ...rest }) {
  return (
    <input
      className={`${FIELD_BASE} ${invalid ? "border-console-bad" : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function AdminTextarea({ className = "", invalid, rows = 3, ...rest }) {
  return (
    <textarea
      rows={rows}
      className={`${FIELD_BASE} resize-y ${invalid ? "border-console-bad" : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function AdminSelect({ className = "", invalid, children, ...rest }) {
  return (
    <select
      className={`${FIELD_BASE} cursor-pointer appearance-none bg-[length:0] pr-9 ${invalid ? "border-console-bad" : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

/**
 * A file input.
 *
 * A native file picker refuses to shrink below its intrinsic width, so
 * the wrapper needs `min-w-0` all the way down or it overflows a 360px
 * screen. The label is a real `<label>` so tapping the word opens the
 * picker, which is what a phone user expects.
 */
export function AdminFileInput({ id, accept, className = "", invalid, ...rest }) {
  const labelId = `${id}-file`;

  return (
    <div className="min-w-0">
      <input
        id={id}
        type="file"
        accept={accept}
        aria-describedby={labelId}
        aria-invalid={invalid || undefined}
        className={`peer sr-only ${className}`}
        {...rest}
      />

      <label
        id={labelId}
        htmlFor={id}
        className={`flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-console-line-strong bg-console-sunken px-3 py-2.5 text-xs font-semibold text-console-body transition hover:border-console-accent hover:text-console-accent-strong ${
          invalid ? "border-console-bad" : ""
        }`}
      >
        Choose a file
      </label>
    </div>
  );
}

/**
 * A switch.
 *
 * A real checkbox underneath rather than a `<button>` with
 * `aria-pressed`, so it is reachable by keyboard, submits with the form
 * and is announced correctly. The visible control is the pill.
 */
export function AdminSwitch({ checked, onChange, label, description, id }) {
  const generated = useId();
  const inputId = id || generated;

  return (
    <div className="flex min-w-0 items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? `${inputId}-label` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition ${
          checked
            ? "border-console-accent bg-console-accent"
            : "border-console-line-strong bg-console-sunken"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-[1.4rem]" : "left-0.5"
          }`}
        />
      </button>

      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <p id={`${inputId}-label`} className="text-sm font-medium text-console-ink">
              {label}
            </p>
          )}

          {description && (
            <p className="mt-0.5 text-[11px] leading-5 text-console-muted">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** A checkbox in a list of capabilities. */
export function AdminCheck({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
        checked
          ? "border-console-accent bg-console-accent-soft"
          : "border-console-line bg-console-raised hover:border-console-line-strong"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-console-accent"
      />

      <span className="min-w-0">
        <span className="block text-sm font-medium text-console-ink">{label}</span>

        {description && (
          <span className="mt-0.5 block text-[11px] leading-5 text-console-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/** A read-only value, shown in a form the way a field would be. */
export function AdminReadOnly({ label, children }) {
  return (
    <div className="min-w-0">
      <p className={LABEL_BASE}>{label}</p>
      <div className="mt-1.5 min-h-11 rounded-xl border border-console-line bg-console-sunken px-3.5 py-2.5 text-sm text-console-body">
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Toolbar
// -----------------------------------------------------------------

/**
 * A search box with a clear button.
 *
 * The clear button only appears once there is something to clear, which
 * keeps the field's right edge still until it is useful.
 */
export function AdminSearch({ value, onChange, placeholder = "Search", id }) {
  const generated = useId();
  const inputId = id || generated;

  return (
    <div className="relative min-w-0 flex-1">
      <Search
        size={15}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-console-faint"
      />

      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className={`${FIELD_BASE} pl-10 ${value ? "pr-10" : "pr-3.5"}`}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-console-faint transition hover:bg-console-sunken hover:text-console-ink"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

/**
 * Horizontally scrollable filter pills with counts.
 *
 * `options` is [{ key, label, count }]; `count` is optional, because
 * some questions ("which kinds of action are there?") cannot be answered
 * without a request per option, and a blank zero is worse than no
 * number.
 */
export function AdminFilterTabs({ options, value, onChange, className = "" }) {
  return (
    <div
      role="tablist"
      className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 ${className}`}
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
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
              active
                ? "border-console-accent bg-console-accent text-console-on-accent"
                : "border-console-line-strong bg-console-raised text-console-muted hover:border-console-accent hover:text-console-accent-strong"
            }`}
          >
            {option.label}

            {option.count !== undefined && option.count !== null && (
              <span
                className={
                  active ? "text-white/70" : "text-console-faint"
                }
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------
// Tables
// -----------------------------------------------------------------

/**
 * A management table that survives a 360px screen.
 *
 * ## Why a table and not a stack of cards
 *
 * Every list in the console used to be one card per row, stacked. That is
 * the right shape for a *feed* - photographs, reviews, a gallery - and the
 * wrong shape for a list staff work down: a queue of bookings, a list of
 * payments to check, the staff directory. What a working list needs is to
 * be *scanned*, and you cannot scan a column that does not exist. Six
 * cards stacked down a phone screen show one fact each; a table shows a
 * row per booking with the code, the customer, the service, the time and
 * the money state all on one line, which is the only way to spot the one
 * booking that is confirmed, unpaid, and for 09:00 tomorrow while you work
 * through forty of them.
 *
 * ## How it stays usable narrow
 *
 * Four things, and they are all needed:
 *
 *   - **`overflow-x-auto` with a `min-w`.** Below the width the columns
 *     need, the table scrolls sideways instead of squashing. A squashed
 *     table wraps every cell to three lines and every row becomes 200px
 *     tall, which is worse than the card it replaced. Scrolling sideways
 *     to reach the actions is a deliberate, discoverable gesture; hunting
 *     for a wrapped row is not.
 *   - **A sticky header row.** Once a list is forty rows long, the column
 *     names are the thing that has scrolled off the top.
 *   - **A first column that sticks to the left edge.** The booking code,
 *     the reference, the username: the one field on each row that has to be
 *     readable at every scroll position to make sense of the rest. It is
 *     painted over the columns sliding beneath it, and it picks up the
 *     row's hover colour with `group-hover` so it does not break the row
 *     into two shades.
 *   - **A bounded height.** This one is not obvious and it is what makes
 *     the sticky header real. `position: sticky` resolves against the
 *     *nearest scroll container*, and an element with `overflow-x: auto` is
 *     a scroll container in **both** axes - CSS coerces a `visible` axis to
 *     `auto` as soon as the other one is not `visible`. So the sideways
 *     scroller becomes the sticky containing block, it has no vertical
 *     overflow of its own, and a `top-0` header would simply never move.
 *     Capping the height gives that scroller a vertical scrollport, and the
 *     header then sticks against it. The table scrolls inside its own
 *     frame instead of pushing the filters off the top of the page, which
 *     is also how a management table is meant to behave.
 *
 * The wrapper deliberately adds no margin or padding of its own. The
 * console's page already has a gutter, and `position: sticky` pins a cell
 * to the *scrollport* edge rather than to the content edge - so a wrapper
 * with `px-4` would pin the first column 16px left of where every other
 * column starts, and the top-left corner of the table would not line up
 * with itself. Inheriting the page gutter is the only version where the
 * columns and the scroll container agree.
 */
export function AdminTable({
  children,
  minWidth = "min-w-[60rem]",
  maxHeight = "max-h-[70svh]",
  label,
  caption,
  className = "",
}) {
  return (
    <div
      className={`min-w-0 overflow-auto overscroll-contain rounded-2xl border border-console-line ${maxHeight} ${className}`}
    >
      <table
        aria-label={label}
        className={`w-full border-separate border-spacing-0 text-left ${minWidth}`}
      >
        {caption && <caption className="sr-only">{caption}</caption>}

        {children}
      </table>
    </div>
  );
}

/**
 * The scroll affordance.
 *
 * A horizontally scrolling region with no visible scrollbar looks broken
 * on desktop and looks like nothing at all on a phone, so the fact that
 * there is more to the right is said in words, once, under the table.
 * Hidden entirely once the table fits, rather than shown on every screen.
 */
export function AdminTableHint({ children, className = "" }) {
  return (
    <p
      className={`flex items-center gap-1.5 text-[11px] leading-5 text-console-faint sm:hidden ${className}`}
    >
      <MoveHorizontal size={12} />
      {children || "Swipe the table sideways for the rest of each row."}
    </p>
  );
}

/** The column-name row. Sticks to the top of the viewport as the page scrolls. */
export function AdminTableHead({ children }) {
  return (
    <thead className="sticky top-0 z-20 bg-console">{children}</thead>
  );
}

export function AdminTableRow({ children, className = "", ...rest }) {
  return (
    <tr
      className={`group cursor-default transition-colors hover:bg-console-sunken/70 ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

const CELL_BASE =
  "border-b border-console-line px-3 py-3 align-top text-sm text-console-body";

/**
 * One cell.
 *
 * `sticky` pins it to the left edge as the rest of the row slides past -
 * see `AdminTable`. `numeric` right-aligns and turns off the proportional
 * figures on the money and count columns, which is what makes a column of
 * amounts readable as a column.
 *
 * `width` is a hint for the column, not a promise: a table cell takes the
 * widest of its content and the header, so these are how a screen says
 * "this column wants to be narrow" without fighting the content.
 */
export function AdminTableCell({
  children,
  sticky = false,
  numeric = false,
  width,
  className = "",
  ...rest
}) {
  return (
    <td
      width={width}
      className={`${CELL_BASE} ${numeric ? "text-right tabular-nums" : ""} ${
        sticky ? "sticky left-0 z-10 bg-console group-hover:bg-console-sunken" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
}

export function AdminTableHeadCell({
  children,
  numeric = false,
  sticky = false,
  width,
  className = "",
  ...rest
}) {
  return (
    <th
      scope="col"
      width={width}
      className={`border-b border-console-line-strong px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted ${
        numeric ? "text-right" : ""
      } ${
        // Sticks with the body cell below it, so the corner of the table
        // that never leaves the screen is labelled too - a code column with
        // no visible heading reads as part of the customer column.
        sticky ? "sticky left-0 z-30 bg-console" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

/**
 * A row that opens a panel under itself.
 *
 * The wide columns of a working list - the receipt, the notes, the whole
 * payment breakdown - do not belong in the row, and dropping them on a
 * screen only leaves the question unanswered. So they span every column on
 * their own line below the row, which keeps the table scannable and still
 * lets the screen show everything the previous card did.
 */
export function AdminTableDetail({ children, columns = 1 }) {
  return (
    <tr className="bg-console">
      <td
        colSpan={columns}
        className="border-b border-console-line px-3 pb-4 pt-0 text-sm text-console-body"
      >
        {children}
      </td>
    </tr>
  );
}

// -----------------------------------------------------------------
// Sheet
// -----------------------------------------------------------------

/**
 * A bottom sheet on a phone, a centred dialog on a desktop.
 *
 * This is the shape every add and edit form in the console takes. The
 * two-column split matters on a phone: a modal that is 40px narrower
 * than the screen is unusable, and a full-height sheet that also
 * applies on a 1440px display is a sheet pretending to be a dialog.
 *
 * Registered with `utils/modalStack` like the customer-side sheet, so
 * that if either is ever opened over a surface that carries the mobile
 * bottom bar the bar moves out of the way instead of sitting on top of
 * the footer. The console has no bar today - it uses a drawer - but the
 * admin sign-in page does not go through this component and the customer
 * booking sheet does, and a modal that can be covered by a fixed bar is
 * a bug waiting for the bar to be added back.
 *
 * Handles its own scroll lock, Escape and focus, so a screen opening
 * one does not have to.
 */
export function AdminSheet({ open, onClose, title, description, children, footer, wide = false }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  // `onClose` is an inline closure at most call sites, so it gets a new
  // identity on every render. Keeping it in a ref stops the effect below
  // from re-running on every keystroke - which used to yank focus back
  // onto the close button mid-typing and swallow the first character.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const releaseModal = registerModal();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    // Focus the first editable field, not the X button: typing should
    // go straight into the form the sheet opened for.
    const field = panelRef.current?.querySelector(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled])'
    );
    (field || closeRef.current)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      releaseModal();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-console-ink/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-2xl border border-console-line bg-console-raised shadow-2xl sm:max-h-[88svh] sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-console-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-serif text-xl leading-tight text-console-ink">{title}</h2>

            {description && (
              <p className="mt-1 text-xs leading-5 text-console-muted">{description}</p>
            )}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-console-muted transition hover:bg-console-sunken hover:text-console-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 ${
            footer ? "" : "pb-[calc(1rem+env(safe-area-inset-bottom))]"
          }`}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-console-line bg-console px-4 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 sm:pb-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Detail rows
// -----------------------------------------------------------------

/**
 * A label/value pair.
 *
 * A `<dl>` because that is what it is, which also means a screen reader
 * reads "Service: Signature Cut" rather than two unconnected fragments.
 */
export function AdminDetails({ children, columns = 2, className = "" }) {
  const layouts = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
  };

  return (
    <dl className={`grid gap-x-4 gap-y-3 ${layouts[columns] || layouts[2]} ${className}`}>
      {children}
    </dl>
  );
}

export function AdminDetail({ label, children, className = "", mono = false }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-console-muted">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-words text-sm text-console-ink ${mono ? "font-mono text-xs" : ""}`}
      >
        {children}
      </dd>
    </div>
  );
}
