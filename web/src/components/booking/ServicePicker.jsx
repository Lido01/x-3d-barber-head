import { ChevronDown, Clock3 } from "lucide-react";

import { mediaUrl } from "../../services/api";
import { formatDuration, formatPrice } from "../../utils/format";
import Alert from "../ui/Alert";
import Spinner from "../ui/Spinner";

const SELECT =
  "w-full appearance-none  border border-white/10 bg-[#181818] px-4 py-4 pr-12 text-sm text-white outline-none transition focus:border-[#d6a85f]/50 disabled:cursor-not-allowed disabled:opacity-60";

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
      <div className=" border border-white/10 bg-white/[0.02] px-4 py-8 text-center">
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

  const selectedService = services.find(
    (service) => String(service.id) === String(selectedId)
  );
  const selectedImage = selectedService && mediaUrl(selectedService.image);

  return (
    <div className="space-y-3">
      <div className="relative">
        <select
          value={selectedId || ""}
          onChange={(event) => {
            const service = services.find(
              (item) => String(item.id) === event.target.value
            );
            if (service) {
              onSelect(service);
            }
          }}
          disabled={disabled}
          aria-label="Choose a service"
          className={SELECT}
        >
          <option value="">Choose a service...</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} — {formatPrice(service.price)} · {formatDuration(service.duration)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={17}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#d6a85f]"
        />
      </div>

      {selectedService && (
        <div className="flex items-center gap-3  border border-[#d6a85f]/20 bg-[#d6a85f]/[0.05] p-3">
          {selectedImage && (
            <img
              src={selectedImage}
              alt=""
              className="h-16 w-20 shrink-0  object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{selectedService.name}</p>
            {selectedService.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/40">
                {selectedService.description}
              </p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#d6a85f]">
              <Clock3 size={12} />
              {formatPrice(selectedService.price)} · {formatDuration(selectedService.duration)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
