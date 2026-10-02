import { useEffect, useRef, useState } from "react";
import { ImageUp, RefreshCw, Trash2 } from "lucide-react";

import FieldError from "./ui/FieldError";

/**
 * Receipt picker for the payment step.
 *
 * Holds the chosen File in state and previews it locally - nothing is
 * uploaded until the customer submits the payment form. The rules
 * mirror the backend's PaymentSerializer.validate_receipt exactly
 * (JPG/PNG/WebP, 5MB) so the customer gets told immediately, while
 * Django still re-validates authoritatively on submit.
 */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

function describeSize(bytes) {
  const mb = bytes / (1024 * 1024);

  return mb >= 1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function validate(file) {
  if (!ACCEPTED.includes(file.type)) {
    return "Receipt must be a JPG, PNG or WebP image.";
  }

  if (file.size > MAX_BYTES) {
    return `That image is ${describeSize(file.size)}. Please choose one under 5 MB.`;
  }

  return null;
}

export default function ReceiptUpload({
  value,
  onChange,
  error,
  progress = null,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Keep the preview URL in step with the selected file, and always
  // release the previous blob.
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(value);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [value]);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleSelect = (event) => {
    const file = event.target.files?.[0];

    // Let the same file be re-picked after a remove.
    event.target.value = "";

    if (!file) {
      return;
    }

    const message = validate(file);

    if (message) {
      setLocalError(message);
      onChange(null);
      return;
    }

    setLocalError(null);
    onChange(file);
  };

  const handleRemove = () => {
    setLocalError(null);
    onChange(null);
  };

  const shownError = localError || error;
  const uploading = progress !== null && progress < 100;

  return (
    <div className="w-full min-w-0">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleSelect}
        disabled={disabled}
        className="hidden"
        aria-label="Payment receipt image"
      />

      {!value && (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="flex w-full min-w-0 flex-col items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center transition hover:border-[#d6a85f]/50 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#181818]">
            <ImageUp size={19} className="text-[#d6a85f]" />
          </span>

          <span className="text-sm font-medium text-white">
            Upload your receipt
          </span>

          <span className="text-[11px] leading-5 text-white/35">
            Tap to choose a photo of your transfer confirmation
            <br />
            JPG, PNG or WebP · up to 5 MB
          </span>
        </button>
      )}

      {value && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex gap-3">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Selected receipt preview"
                className="h-20 w-20 shrink-0 rounded-lg border border-white/10 object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="break-all text-xs font-medium text-white">
                {value.name}
              </p>

              <p className="mt-1 text-[11px] text-white/35">
                {describeSize(value.size)}
              </p>

              {/* min-h keeps both buttons at the 44px floor the layout
                  rules ask for; without it these are the two smallest
                  tap targets on the payment screen. */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={disabled}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[11px] font-medium text-white/75 transition hover:border-[#d6a85f]/50 hover:text-white disabled:opacity-50"
                >
                  <RefreshCw size={11} />
                  Replace
                </button>

                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[11px] font-medium text-white/55 transition hover:border-[#e05a4f]/50 hover:text-[#e0776b] disabled:opacity-50"
                >
                  <Trash2 size={11} />
                  Remove
                </button>
              </div>
            </div>
          </div>

          {progress !== null && (
            <div className="mt-3">
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#d6a85f] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/35">
                {uploading ? `Uploading receipt · ${progress}%` : "Upload complete"}
              </p>
            </div>
          )}
        </div>
      )}

      <FieldError message={shownError} />
    </div>
  );
}
