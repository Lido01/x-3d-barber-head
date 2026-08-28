import { Check, Clock3 } from "lucide-react";

import { mediaUrl } from "../../services/api";
import { formatDuration, formatPrice } from "../../utils/format";
import Alert from "../ui/Alert";
import Spinner from "../ui/Spinner";

/**
 * Step 1 - pick a service.
 *
 * Every field shown comes from ServiceSerializer: name, description,
 * price, duration and the optional image.
 */
export default function ServicePicker({
  services,
  loading,
  error,
  onReload,
  selectedId,
  onSelect,
  disabled = false,
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center">
        <Spinner label="Loading services..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        tone="error"
        title="Could not load services"
        details={error.fieldErrors}
        onRetry={onReload}
      >
        {error.message}
      </Alert>
    );
  }

  if (services.length === 0) {
    return (
      <Alert tone="info" title="No services available yet" onRetry={onReload}>
        The shop has not published any services. Please check back soon.
      </Alert>
    );
  }

  return (
    <div className="grid gap-2">
      {services.map((service) => {
        const selected = String(service.id) === String(selectedId);
        const image = mediaUrl(service.image);

        return (
          <button
            type="button"
            key={service.id}
            onClick={() => onSelect(service)}
            disabled={disabled}
            aria-pressed={selected}
            className={`flex items-center gap-4 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? "border-[#d6a85f]/50 bg-[#d6a85f]/10"
                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
            }`}
          >
            {image && (
              <img
                src={image}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p
                  className={`text-sm font-medium ${
                    selected ? "text-white" : "text-white/75"
                  }`}
                >
                  {service.name}
                </p>

                <span
                  className={`shrink-0 text-sm font-semibold ${
                    selected ? "text-[#d6a85f]" : "text-white/60"
                  }`}
                >
                  {formatPrice(service.price)}
                </span>
              </div>

              {service.description && (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/35">
                  {service.description}
                </p>
              )}

              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
                <Clock3 size={12} />
                {formatDuration(service.duration)}
              </p>
            </div>

            {selected && (
              <Check size={16} className="shrink-0 self-start text-[#d6a85f]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
