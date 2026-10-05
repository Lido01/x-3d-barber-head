import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  MessageCircleQuestion,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { chatWithAgent } from "../../services/aiAgentApi";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  isAiChatDismissed,
  readAiBookingContext,
  setAiChatDismissed,
  useAiChatOpen,
} from "../../utils/aiChat";
import { registerModal } from "../../utils/modalStack";

/**
 * The AI booking assistant, floating on the storefront.
 *
 * ## Where it sits
 *
 * Bottom-right, above the mobile app bar (`utils/modalStack` is used
 * below, so the bar steps aside the moment the panel opens rather than
 * sitting on top of the composer). On `lg` and up the app bar is gone and
 * the launcher drops to the corner, so the two offsets are genuinely
 * different problems and not one number reused.
 *
 * ## Why it can be closed, minimised *and* re-opened
 *
 * Three separate states, because they answer three different complaints:
 *
 *   open       the panel is up
 *   minimised  "too much screen, I want the content" — the panel is gone,
 *              the launcher is still there, the conversation is still in
 *              state so coming back loses nothing
 *   dismissed  "get rid of it" — the launcher itself goes. Stored in
 *              sessionStorage, so it does not come back on the next
 *              navigation, and so a visit that starts on a phone in a
 *              hurry is not greeted by it again. The chat is also
 *              reachable from the bottom bar's More sheet, which is what
 *              makes "dismissed for now" honest rather than "gone".
 *
 * Collapsing to the launcher rather than unmounting is what makes it
 * cheap: the transcript, the composer text and the scroll position are
 * all component state, so nothing has to be persisted or restored.
 */

/** 32 messages is several screens of scrolling; past that nobody reads back. */
const MAX_MESSAGES = 40;

const SUGGESTION_KEYS = ["ai.suggestions.cuts", "ai.suggestions.price", "ai.suggestions.free", "ai.suggestions.book"];

const PANEL =
  "pointer-events-auto flex w-[calc(100vw-1.5rem)] max-w-[23rem] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0d0d0d]/97 shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-xl";

const BUBBLE = (mine) =>
  mine
    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#d6a85f] px-3.5 py-2.5 text-left text-sm leading-6 text-black"
    : "mr-auto max-w-[88%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-left text-sm leading-6 text-white/80";

export default function AiChatWidget() {
  const { t } = useLanguage();
  const openRequest = useAiChatOpen();

  const [dismissed, setDismissed] = useState(() => isAiChatDismissed());
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);

  /**
   * A monotonic counter for transcript keys.
   *
   * The obvious `role + messages.length + text` collides: the list is
   * trimmed to MAX_MESSAGES, so `length` stops growing, and asking the
   * same question twice produces the same key. React then merges the two
   * rows and logs "Encountered two children with the same key" on every
   * render. A counter cannot collide and costs one ref.
   */
  const messageId = useRef(0);

  /** Set synchronously, unlike `thinking`, so a double Enter cannot slip a second request past the guard. */
  const inFlight = useRef(false);

  /**
   * Keep the newest message in view.
   *
   * Only when the customer is already at the bottom. Yanking the view
   * down while they are reading further back is worse than not following
   * the conversation at all.
   */
  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;

    if (distanceFromBottom < 120) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, thinking]);

  const send = useCallback(
    async (text) => {
      const message = (text || "").trim();

      if (!message || inFlight.current) {
        return;
      }

      inFlight.current = true;
      setDraft("");
      setError(null);
      setMessages((current) => [
        ...current.slice(-(MAX_MESSAGES - 1)),
        {
          id: `m${messageId.current++}`,
          role: "customer",
          text: message,
        },
      ]);
      setThinking(true);

      // Read at send time, so the assistant has the service and slot the
      // customer has chosen *now* - see utils/aiChat.js.
      const context = readAiBookingContext() || {};

      try {
        const reply = await chatWithAgent({
          message,
          customerName: context.customerName,
          customerPhone: context.customerPhone,
          serviceId: context.serviceId,
          bookingDate: context.bookingDate,
          startTime: context.startTime,
        });

        setMessages((current) => [
          ...current.slice(-(MAX_MESSAGES - 1)),
          {
            id: `m${messageId.current++}`,
            role: "assistant",
            text: reply.message,
          },
        ]);
      } catch (apiError) {
        setError(apiError);
      } finally {
        inFlight.current = false;
        setThinking(false);
      }
    },
    []
  );

  // A page asked for the panel — /booking's "ask about this" button, or
  // the More sheet after it was dismissed. `restored` means the customer
  // wants it back after closing it, so the launcher returns too.
  useEffect(() => {
    if (!openRequest) {
      return;
    }

    if (openRequest.restored) {
      setDismissed(false);
    }

    setOpen(true);

    if (openRequest.message) {
      send(openRequest.message);
    }
  }, [openRequest, send]);

  // The bar has to move out of the way while the panel is up. Registered
  // only when open, so a minimised launcher does not hide the navigation
  // it is sitting above.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    return registerModal();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setOpen(false);
    setDismissed(true);
    setAiChatDismissed(true);
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    setDraft("");
  };

  const showLauncher = !open;

  return (
    <div
      // Above the mobile app bar - `z-55`, and about 92px tall including
      // its floating inset - and clear of the home indicator on a notched
      // phone. From `lg` the bar is gone, so the launcher drops into the
      // corner instead: two genuinely different problems, not one number
      // reused. `_` is a space, which `calc()` requires around `+`.
      className="pointer-events-none fixed right-3 z-[60] bottom-[calc(env(safe-area-inset-bottom)_+_5.75rem)] sm:right-5 lg:right-6 lg:bottom-6"
    >
      {showLauncher && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("ai.open")}
          title={t("ai.open")}
          className="pointer-events-auto group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#d6a85f] text-black shadow-[0_12px_32px_rgba(214,168,95,0.4)] transition hover:bg-[#e5bd7a] active:scale-95"
        >
          <span className="pulse-ring absolute inset-0 rounded-full" aria-hidden="true" />
          <MessageCircleQuestion size={22} strokeWidth={2.2} />
        </button>
      )}

      {open && (
        <div role="dialog" aria-label={t("ai.title")} className={PANEL}>
          {/* Header. Two controls, not one: minimise keeps the
              conversation, close removes the launcher entirely. */}
          <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3.5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d6a85f] text-black">
              <Bot size={17} strokeWidth={2.2} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {t("ai.title")}
              </p>
              <p className="truncate text-[10px] text-white/40">
                {t("ai.subtitle")}
              </p>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={t("ai.clear")}
                title={t("ai.clear")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/70"
              >
                <Trash2 size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("ai.minimize")}
              title={t("ai.minimize")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/5 hover:text-white"
            >
              <ChevronDown size={17} />
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label={t("ai.close")}
              title={t("ai.close")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-[#e05a4f]/15 hover:text-[#e0776b]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Transcript */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3.5"
            style={{ maxHeight: "min(52svh, 24rem)" }}
          >
            {messages.length === 0 && !thinking && (
              <div className="space-y-3">
                <p className="flex items-start gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm leading-6 text-white/70">
                  <Sparkles size={15} className="mt-1 shrink-0 text-[#d6a85f]" />
                  {t("ai.emptyBody")}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTION_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => send(t(key))}
                      className="rounded-full border border-white/12 px-3 py-1.5 text-left text-[11px] leading-4 text-white/55 transition hover:border-[#d6a85f]/60 hover:text-[#d6a85f]"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((entry) => (
              <p key={entry.id} className={BUBBLE(entry.role === "customer")}>
                {entry.text}
              </p>
            ))}

            {thinking && (
              <p className="flex items-center gap-2 text-xs text-white/40">
                <RefreshCw size={12} className="animate-spin text-[#d6a85f]" />
                {t("ai.thinking")}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-[#e05a4f]/30 bg-[#e05a4f]/10 px-3 py-2.5 text-xs leading-5 text-[#e0776b]"
              >
                {t("ai.errorBody")}
              </p>
            )}
          </div>

          {/* Composer. Sends on Enter, newlines on Shift+Enter, which is
              what a keyboard does everywhere else and the only reason
              the textarea is here at all. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
            className="shrink-0 border-t border-white/10 p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(draft);
                  }
                }}
                rows={1}
                maxLength={500}
                placeholder={t("ai.placeholder")}
                aria-label={t("ai.placeholder")}
                className="max-h-24 min-h-11 w-full min-w-0 flex-1 resize-none rounded-xl border border-white/12 bg-[#161616] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50"
              />

              <button
                type="submit"
                disabled={thinking || !draft.trim()}
                aria-label={t("ai.send")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d6a85f] text-black transition hover:bg-[#e5bd7a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
