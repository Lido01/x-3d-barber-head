/**
 * Gallery moderation.
 *
 * Photos are the one admin screen that is genuinely visual, so the card
 * grid starts at one column on a phone and widens from sm: two cards at
 * 640px left a 200px-wide image per card on a large phone, which is too
 * small to judge whether the photo is a good one.
 *
 * The form's Image / Visible / Save row was a three-item flex row that
 * overflowed at 360px; it is now a stacked column with full-width
 * controls, matching the service editor.
 */
import { useCallback, useEffect, useState } from "react";
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
import FieldError from "../../components/ui/FieldError";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
} from "../../components/admin/AdminUi";
import { mediaUrl } from "../../services/api";
import {
  createGalleryPost,
  deleteGalleryPost,
  listGalleryPosts,
  updateGalleryPost,
} from "../../services/galleryApi";

const INPUT =
  "w-full min-w-0 rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50 sm:text-sm";

const LABEL =
  "block text-[10px] uppercase tracking-[0.25em] text-white/35";

const FILE_INPUT =
  "w-full min-w-0 text-xs text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-[#d6a85f] file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-black";

const BLANK = { title: "", description: "", style_name: "" };

export default function AdminGallery() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState(null); // null | "new" | post
  const [form, setForm] = useState(BLANK);
  const [imageFile, setImageFile] = useState(null);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setRefreshing(true);

    return listGalleryPosts({ requiresAuth: true })
      .then((data) => {
        setPosts(Array.isArray(data) ? data : data?.results || []);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((apiError) => {
        setError(apiError);
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const closeForm = () => {
    setEditing(null);
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
      load();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete gallery post "${post.title}"?`)) {
      return;
    }

    setBusyId(post.id);
    setActionError(null);

    try {
      await deleteGalleryPost(post.id);
      setPosts((rows) => rows.filter((row) => row.id !== post.id));
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
      const updated = await updateGalleryPost(post.id, {
        is_active: nextValue,
      });

      setPosts((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row))
      );
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Staff · Management"
        title="Gallery"
        description="Photos shown on the public gallery."
        actions={
          <>
            <AdminButton
              onClick={load}
              icon={RefreshCw}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </AdminButton>

            <AdminButton
              tone={editing === null ? "primary" : "neutral"}
              icon={editing === null ? Plus : X}
              onClick={() =>
                editing === null ? openNew() : closeForm()
              }
            >
              {editing === null ? "Add photo" : "Cancel"}
            </AdminButton>
          </>
        }
      />

      {actionError && (
        <Alert
          tone="error"
          title="Action failed"
          details={actionError.fieldErrors}
          className="mt-5"
        >
          {actionError.message}
        </Alert>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          noValidate
          className="mt-6 rounded-2xl border border-white/10 bg-[#111] p-4 sm:p-6"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
            {editing === "new"
              ? "Add a gallery post"
              : `Edit #${editing.id}`}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className={LABEL}>Title</label>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    title: event.target.value,
                  }))
                }
                className={`${INPUT} mt-2`}
              />
              <FieldError
                message={actionError?.fieldErrors?.title}
              />
            </div>

            <div className="min-w-0">
              <label className={LABEL}>Style name</label>
              <input
                value={form.style_name}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    style_name: event.target.value,
                  }))
                }
                placeholder="e.g. Low Fade"
                className={`${INPUT} mt-2`}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={LABEL}>Description</label>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  description: event.target.value,
                }))
              }
              rows={2}
              className={`${INPUT} mt-2 resize-none`}
            />
          </div>

          <div className="mt-4">
            <label className={LABEL}>Image</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setImageFile(event.target.files[0] || null)
              }
              className={`mt-2 ${FILE_INPUT}`}
            />
            <FieldError message={actionError?.fieldErrors?.image} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setActive((value) => !value)}
              aria-pressed={active}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition ${
                active
                  ? "border-[#5fb98a]/40 bg-[#5fb98a]/10 text-[#7fcfa4]"
                  : "border-white/15 text-white/50"
              }`}
            >
              {active ? (
                <>
                  <Eye size={14} /> Visible on the site
                </>
              ) : (
                <>
                  <EyeOff size={14} /> Hidden
                </>
              )}
            </button>

            <AdminButton
              type="submit"
              tone="primary"
              disabled={saving}
              className="sm:justify-self-end"
            >
              {saving ? "Saving..." : "Save"}
            </AdminButton>
          </div>
        </form>
      )}

      {loading && <AdminLoading label="Loading gallery..." />}

      {!loading && error && (
        <Alert
          tone="error"
          title="Could not load gallery"
          details={error.fieldErrors}
          onRetry={load}
          className="mt-8"
        >
          {error.message}
        </Alert>
      )}

      {!loading && !error && posts.length === 0 && (
        <AdminEmpty
          title="Nothing here yet"
          body="Add a photo to start the gallery."
          onRetry={load}
        />
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {posts.map((post) => {
            const busy = busyId === post.id;

            return (
              <article
                key={post.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111]"
              >
                <div className="relative h-48 sm:h-44">
                  {post.image ? (
                    <img
                      src={mediaUrl(post.image)}
                      alt={post.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#242424] to-[#0d0d0d] text-xs text-white/20">
                      No image
                    </div>
                  )}

                  <span
                    className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                      post.is_active
                        ? "bg-[#5fb98a] text-black"
                        : "bg-white/20 text-white backdrop-blur"
                    }`}
                  >
                    {post.is_active ? "Visible" : "Hidden"}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[#d6a85f]">
                    {post.style_name || "Recent work"}
                  </p>

                  <p className="mt-1 break-words font-serif text-lg sm:text-xl">
                    {post.title}
                  </p>

                  <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/45">
                    {post.description || "—"}
                  </p>

                  {/* mt-auto pins the actions to the bottom so cards in a
                      row line up even when descriptions differ in length */}
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    <AdminButton
                      icon={Pencil}
                      onClick={() => openEdit(post)}
                      disabled={busy}
                    >
                      Edit
                    </AdminButton>

                    <AdminButton
                      icon={post.is_active ? EyeOff : Eye}
                      onClick={() =>
                        handleToggleActive(post, !post.is_active)
                      }
                      disabled={busy}
                    >
                      {busy
                        ? "..."
                        : post.is_active
                          ? "Hide"
                          : "Show"}
                    </AdminButton>

                    <AdminButton
                      tone="danger"
                      icon={Trash2}
                      onClick={() => handleDelete(post)}
                      disabled={busy}
                    >
                      Delete
                    </AdminButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
