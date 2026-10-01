import { useState } from "react";
import {
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminConfirmButton,
  AdminEmpty,
  AdminField,
  AdminFileInput,
  AdminInput,
  AdminLoading,
  AdminPageHeader,
  AdminSheet,
  AdminSwitch,
  AdminTextarea,
} from "../../components/admin/AdminUi";
import { mediaUrl } from "../../services/api";
import { toArray } from "../../utils/toArray";
import {
  createGalleryPost,
  deleteGalleryPost,
  listGalleryPosts,
  updateGalleryPost,
} from "../../services/galleryApi";
import { invalidateQuery, useQuery } from "../../hooks/useQuery";

/**
 * Gallery moderation.
 *
 * Photos are the one admin screen that is genuinely visual, so the card
 * grid starts at one column on a phone and widens from sm: two cards at
 * 640px left a 200px-wide image per card on a large phone, which is too
 * small to judge whether the photo is a good one.
 *
 * The add/edit form is a sheet for the same reason as everywhere else in
 * the console: an inline form pushes the grid out from under the
 * cursor, and on a phone it scrolls the card being edited off the top.
 *
 * Visibility is a switch rather than a button because it is a state,
 * not an action — the label says what the post *is*, and tapping it
 * changes that. The separate Hide/Show button stays on each card for the
 * common case of flipping one without opening the form.
 */

const BLANK = { title: "", description: "", style_name: "" };

export default function AdminGallery() {
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [editing, setEditing] = useState(null); // null | "new" | post
  const [form, setForm] = useState(BLANK);
  const [imageFile, setImageFile] = useState(null);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Scope "staff": staff see every post including hidden ones, the public
  // only sees active ones. One shared key would leak hidden photos.
  const {
    data: posts,
    loading,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery(
    "/gallery/gallery/",
    (signal) => listGalleryPosts({ signal, requiresAuth: true }),
    {
      scope: "staff",
      select: toArray,
    }
  );

  const rows = posts || [];

  /** A write here changes the public gallery too, so drop both views. */
  const refreshBothViews = () => invalidateQuery("gallery");

  const closeForm = () => {
    setEditing(null);
    setImageFile(null);
    setActionError(null);
  };

  const openNew = () => {
    setEditing("new");
    setForm(BLANK);
    setImageFile(null);
    setActive(true);
    setActionError(null);
  };

  const openEdit = (post) => {
    setEditing(post);
    setForm({
      title: post.title,
      description: post.description || "",
      style_name: post.style_name || "",
    });
    setImageFile(null);
    setActive(post.is_active);
    setActionError(null);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setActionError(null);

    if (!form.title.trim()) {
      setActionError({ message: "A title is required.", fieldErrors: {} });
      return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      style_name: form.style_name.trim(),
      is_active: active,
      image: imageFile || undefined,
    };

    try {
      if (editing === "new") {
        await createGalleryPost(payload);
      } else {
        await updateGalleryPost(editing.id, payload);
      }

      closeForm();
      refreshBothViews();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    setBusyId(post.id);
    setActionError(null);

    try {
      await deleteGalleryPost(post.id);
      refreshBothViews();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (post, nextValue) => {
    setBusyId(post.id);
    setActionError(null);

    try {
      await updateGalleryPost(post.id, {
        is_active: nextValue,
      });

      refreshBothViews();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const fieldError = (name) => actionError?.fieldErrors?.[name];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Gallery"
        description="Photos shown on the public gallery."
        actions={
          <>
            <AdminButton onClick={load} icon={RefreshCw} loading={refreshing}>
              Refresh
            </AdminButton>

            <AdminButton
              tone={editing === null ? "primary" : "neutral"}
              icon={editing === null ? Plus : X}
              onClick={editing === null ? openNew : closeForm}
            >
              {editing === null ? "Add photo" : "Cancel"}
            </AdminButton>
          </>
        }
      />

      {actionError && !editing && (
        <Alert tone="error" title="Action failed" details={actionError.fieldErrors}>
          {actionError.message}
        </Alert>
      )}

      {loading && <AdminLoading label="Loading gallery..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load gallery"
          details={error.fieldErrors}
          onRetry={load}
        >
          {error.message}
        </Alert>
      )}

      {!loading && !error && rows.length === 0 && (
        <AdminEmpty
          title="No photos yet"
          body="Add a photo to start the gallery."
          onRetry={load}
          action={
            <AdminButton tone="primary" icon={Plus} onClick={openNew}>
              Add the first photo
            </AdminButton>
          }
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {rows.map((post) => {
            const busy = busyId === post.id;

            return (
              <li key={post.id}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-console-line bg-console-raised">
                  <div className="relative h-48 bg-console-sunken sm:h-44">
                    {post.image ? (
                      <img
                        src={mediaUrl(post.image)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-console-faint">
                        No image
                      </div>
                    )}

                    <span className="absolute left-3 top-3">
                      <AdminChip tone={post.is_active ? "good" : "neutral"}>
                        {post.is_active ? "Visible" : "Hidden"}
                      </AdminChip>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-console-accent">
                      {post.style_name || "Recent work"}
                    </p>

                    <p className="mt-1 break-words font-serif text-lg leading-tight text-console-ink sm:text-xl">
                      {post.title}
                    </p>

                    <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-console-muted">
                      {post.description || "—"}
                    </p>

                    {/* mt-auto pins the actions to the bottom so cards in a
                        row line up even when descriptions differ in length */}
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-console-line pt-4">
                      <AdminButton
                        size="sm"
                        icon={Pencil}
                        loading={busy}
                        onClick={() => openEdit(post)}
                      >
                        Edit
                      </AdminButton>

                      <AdminButton
                        size="sm"
                        icon={post.is_active ? EyeOff : Eye}
                        loading={busy}
                        onClick={() =>
                          handleToggleActive(post, !post.is_active)
                        }
                      >
                        {post.is_active ? "Hide" : "Show"}
                      </AdminButton>

                      <AdminConfirmButton
                        size="sm"
                        icon={Trash2}
                        loading={busy}
                        message={`Delete gallery post "${post.title}"? This cannot be undone.`}
                        onConfirm={() => handleDelete(post)}
                      >
                        Delete
                      </AdminConfirmButton>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <AdminSheet
        open={Boolean(editing)}
        onClose={closeForm}
        title={editing === "new" ? "Add a photo" : "Edit photo"}
        description={
          editing === "new"
            ? "Shown on the public gallery page."
            : `Editing #${editing?.id}.`
        }
        footer={
          <>
            <AdminButton onClick={closeForm} disabled={saving}>
              Cancel
            </AdminButton>

            <AdminButton
              type="submit"
              form="gallery-form"
              tone="primary"
              loading={saving}
            >
              {saving ? "Saving..." : "Save"}
            </AdminButton>
          </>
        }
      >
        {editing && (
          <form
            id="gallery-form"
            onSubmit={handleSave}
            noValidate
            className="space-y-4"
          >
            {actionError && (
              <Alert tone="error" title="Could not save" details={actionError.fieldErrors}>
                {actionError.message}
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField
                label="Title"
                required
                error={fieldError("title")}
              >
                <AdminInput
                  value={form.title}
                  invalid={Boolean(fieldError("title"))}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, title: event.target.value }))
                  }
                />
              </AdminField>

              <AdminField
                label="Style name"
                error={fieldError("style_name")}
                hint="Optional label above the title."
              >
                <AdminInput
                  value={form.style_name}
                  placeholder="e.g. Low Fade"
                  onChange={(event) =>
                    setForm((f) => ({ ...f, style_name: event.target.value }))
                  }
                />
              </AdminField>
            </div>

            <AdminField label="Description" error={fieldError("description")}>
              <AdminTextarea
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((f) => ({ ...f, description: event.target.value }))
                }
              />
            </AdminField>

            <AdminField
              label={editing === "new" ? "Photo" : "Replace photo"}
              error={fieldError("image")}
              hint="JPG, PNG or WebP, up to 5MB."
            >
              <AdminFileInput
                id="gallery-image"
                accept="image/jpeg,image/png,image/webp"
                invalid={Boolean(fieldError("image"))}
                onChange={(event) =>
                  setImageFile(event.target.files[0] || null)
                }
              />
            </AdminField>

            <div className=" rounded-xl border border-console-line bg-console-sunken p-3.5">
              <AdminSwitch
                checked={active}
                onChange={setActive}
                label={active ? "Visible on the site" : "Hidden"}
                description={
                  active
                    ? "Appears in the public gallery."
                    : "Kept for later — not shown to customers."
                }
              />
            </div>
          </form>
        )}
      </AdminSheet>
    </div>
  );
}
