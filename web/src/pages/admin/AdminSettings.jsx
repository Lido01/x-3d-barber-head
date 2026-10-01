import { useEffect, useState } from "react";
import { Save } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminLoading,
  AdminPageHeader,
  AdminSection,
  ThemeToggle,
} from "../../components/admin/AdminUi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { getShopSettings, updateShopSettings } from "../../services/authApi";
import { invalidateQuery, useQuery } from "../../hooks/useQuery";
import { hasCapability } from "../../utils/staffRole";

/**
 * Shop settings — the things that were hardcoded in the markup.
 *
 * A settings screen that only shows a form is worse than no settings
 * screen, because it teaches staff that the numbers they can change are
 * not the numbers the shop actually uses. So every field here is read
 * back from the same row the booking form and the public contact details
 * are built from, and the write is a PATCH against that row.
 *
 * Split into three sections by how dangerous the field is:
 *
 *   Shop        the name and tagline on every page
 *   Contact     what a customer reads to reach you
 *   Booking     when the chair is available
 *
 * Appearance is here too, but it is deliberately *not* saved to the
 * server. Theme is a fact about the device in front of you - a phone in
 * someone's pocket - not about the shop, and syncing it would mean the
 * console changed colour because a different person signed in on the
 * same machine.
 */

const FIELDS = [
  "business_name",
  "tagline",
  "phone",
  "email",
  "address",
  "currency",
  "opening_time",
  "closing_time",
  "booking_horizon_days",
];

const EMPTY = {
  business_name: "",
  tagline: "",
  phone: "",
  email: "",
  address: "",
  currency: "ETB",
  opening_time: "09:00",
  closing_time: "21:00",
  booking_horizon_days: "60",
};

export default function AdminSettings() {
  const { account } = useAdminAuth();

  const canEdit = hasCapability(account, "settings.manage");

  const { data, loading, error, refetch } = useQuery(
    "/accounts/settings/",
    getShopSettings,
    {
      scope: "staff",
      staleMs: 5 * 60 * 1000,
    }
  );

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Seed the form once the row arrives, and again whenever it changes
  // underneath us. Keyed on the whole payload rather than a field, so a
  // value the API drops from the form is cleared instead of lingering.
  useEffect(() => {
    if (!data) {
      return;
    }

    const seeded = { ...EMPTY };

    for (const field of FIELDS) {
      if (data[field] !== undefined && data[field] !== null) {
        seeded[field] = String(data[field]);
      }
    }

    setForm(seeded);
  }, [data]);

  /** Only send what actually changed, so the audit log stays readable. */
  const changed = () => {
    if (!data) {
      return {};
    }

    const patch = {};

    for (const field of FIELDS) {
      if (form[field] !== String(data[field] ?? "")) {
        patch[field] =
          field === "booking_horizon_days"
            ? Number(form[field])
            : form[field];
      }
    }

    return patch;
  };

  const save = async (event) => {
    event.preventDefault();

    if (saving || !canEdit) {
      return;
    }

    const patch = changed();

    if (Object.keys(patch).length === 0) {
      setNotice("Nothing to save.");
      return;
    }

    setSaving(true);
    setActionError(null);
    setNotice(null);

    try {
      await updateShopSettings(patch);

      // The dashboard header and the storefront's contact block both
      // read this, so both views are now stale.
      invalidateQuery("accounts/settings");

      setNotice(
        "Saved. The booking form and your public contact details now use these.",
      );
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name) => actionError?.fieldErrors?.[name];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Management"
        title="Settings"
        description="The shop's own details. Everything here is read back by the booking form and the public contact details, so changing it changes the site."
      />

      {!canEdit && !loading && (
        <Alert tone="info" title="Read only">
          You can read the shop's settings, but changing them needs the{" "}
          <strong className="font-semibold">Change shop settings</strong>{" "}
          capability. Ask an administrator to grant it.
        </Alert>
      )}

      {error && (
        <Alert
          tone="error"
          title="Could not load settings"
          details={error.fieldErrors}
          onRetry={refetch}
        >
          {error.message}
        </Alert>
      )}

      {actionError && (
        <Alert tone="error" title="Could not save" details={actionError.fieldErrors}>
          {actionError.message}
        </Alert>
      )}

      {notice && !actionError && (
        <Alert tone="success" title={notice} onRetry={() => setNotice(null)}>
          <span className="text-xs">Saved</span>
        </Alert>
      )}

      {loading && <AdminLoading label="Loading shop settings..." />}

      {data && (
        <form onSubmit={save} noValidate className="space-y-5">
          <AdminSection
            title="Shop"
            description="The name and line shown across the site."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField
                label="Business name"
                required
                error={fieldError("business_name")}
              >
                <AdminInput
                  value={form.business_name}
                  disabled={!canEdit}
                  invalid={Boolean(fieldError("business_name"))}
                  onChange={(event) =>
                    setForm({ ...form, business_name: event.target.value })
                  }
                />
              </AdminField>

              <AdminField
                label="Currency"
                error={fieldError("currency")}
                hint="How prices are labelled. Does not convert anything."
              >
                <AdminInput
                  value={form.currency}
                  disabled={!canEdit}
                  maxLength={8}
                  invalid={Boolean(fieldError("currency"))}
                  onChange={(event) =>
                    setForm({ ...form, currency: event.target.value })
                  }
                />
              </AdminField>
            </div>

            <AdminField
              className="mt-4"
              label="Tagline"
              error={fieldError("tagline")}
            >
              <AdminInput
                value={form.tagline}
                disabled={!canEdit}
                placeholder="Optional one-liner"
                invalid={Boolean(fieldError("tagline"))}
                onChange={(event) =>
                  setForm({ ...form, tagline: event.target.value })
                }
              />
            </AdminField>
          </AdminSection>

          <AdminSection
            title="Contact"
            description="What a customer reads to reach the shop."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Phone" error={fieldError("phone")}>
                <AdminInput
                  type="tel"
                  value={form.phone}
                  disabled={!canEdit}
                  invalid={Boolean(fieldError("phone"))}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </AdminField>

              <AdminField label="Email" error={fieldError("email")}>
                <AdminInput
                  type="email"
                  value={form.email}
                  disabled={!canEdit}
                  invalid={Boolean(fieldError("email"))}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </AdminField>
            </div>

            <AdminField
              className="mt-4"
              label="Address"
              error={fieldError("address")}
            >
              <AdminInput
                value={form.address}
                disabled={!canEdit}
                placeholder="Street, district, city"
                invalid={Boolean(fieldError("address"))}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </AdminField>
          </AdminSection>

          <AdminSection
            title="Booking"
            description="When the chair is bookable. The booking form computes its slots from these."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <AdminField label="Opens" error={fieldError("opening_time")}>
                <AdminInput
                  type="time"
                  value={form.opening_time}
                  disabled={!canEdit}
                  invalid={Boolean(fieldError("opening_time"))}
                  onChange={(event) =>
                    setForm({ ...form, opening_time: event.target.value })
                  }
                />
              </AdminField>

              <AdminField
                label="Closes"
                error={fieldError("closing_time")}
                hint="Must be after opening."
              >
                <AdminInput
                  type="time"
                  value={form.closing_time}
                  disabled={!canEdit}
                  invalid={Boolean(fieldError("closing_time"))}
                  onChange={(event) =>
                    setForm({ ...form, closing_time: event.target.value })
                  }
                />
              </AdminField>

              <AdminField
                label="Book up to (days)"
                error={fieldError("booking_horizon_days")}
                hint="How far ahead customers may book."
              >
                <AdminInput
                  type="number"
                  min="0"
                  max="730"
                  inputMode="numeric"
                  value={form.booking_horizon_days}
                  disabled={!canEdit}
                  invalid={Boolean(fieldError("booking_horizon_days"))}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      booking_horizon_days: event.target.value,
                    })
                  }
                />
              </AdminField>
            </div>
          </AdminSection>

          {canEdit && (
            <div className="sticky bottom-4 z-20 flex justify-end gap-2 rounded-2xl border border-console-line bg-console-raised/95 p-3 shadow-lg backdrop-blur">
              <AdminButton
                type="button"
                onClick={() => {
                  setForm({ ...EMPTY, ...data });
                  setActionError(null);
                  setNotice(null);
                }}
                disabled={saving}
              >
                Discard changes
              </AdminButton>

              <AdminButton type="submit" tone="primary" icon={Save} loading={saving}>
                Save settings
              </AdminButton>
            </div>
          )}
        </form>
      )}

      <AppearanceSection />
    </div>
  );
}

/**
 * Appearance, kept out of the saved form on purpose.
 *
 * Theme is a fact about the device in front of you, not about the shop.
 * Syncing it would mean the console changed colour because a different
 * person signed in on a shared machine - which is the opposite of what
 * someone picks a dark theme for.
 */
function AppearanceSection() {
  return (
    <AdminSection
      title="Appearance"
      description="This device only. Not shared with other staff."
    >
      <ThemeToggle />
    </AdminSection>
  );
}
