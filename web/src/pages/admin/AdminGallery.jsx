import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import FieldError from "../../components/ui/FieldError";
import Spinner from "../../components/ui/Spinner";
import { mediaUrl } from "../../services/api";
import {
  createGalleryPost,
  deleteGalleryPost,
  listGalleryPosts,
  updateGalleryPost,
} from "../../services/galleryApi";

const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d6a85f]/50";

export default function AdminGallery() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [editing, setEditing] = useState(null); // null | "new" | post
  const [form, setForm] = useState({ title: "", description: "", style_name: "" });
  const [imageFile, setImageFile] = useState(null);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    return listGalleryPosts({ requiresAuth: true })
      .then((data) => {
        setPosts(Array.isArray(data) ? data : data?.results || []);
        setLoading(false);
      })
      .catch((apiError) => {
        setError(apiError);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing("new");
    setForm({ title: "", description: "", style_name: "" });
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

    try {
      if (editing === "new") {
        await createGalleryPost({
          title: form.title.trim(),
          description: form.description.trim(),
          style_name: form.style_name.trim(),
          is_active: active,
          image: imageFile || undefined,
        });
      } else {
        await updateGalleryPost(editing.id, {
          title: form.title.trim(),
          description: form.description.trim(),
          style_name: form.style_name.trim(),
          is_active: active,
          image: imageFile || undefined,
        });
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
      const updated = await updateGalleryPost(post.id, { is_active: nextValue });
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
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#d6a85f]">
            Staff · Management
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-none sm:text-5xl">
            Gallery
          </h1>
          <p className="mt-3 text-xs text-white/35">
            Photos shown on the public gallery.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white"
          >
            <RefreshCw size={13} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => (editing === null ? openNew() : closeForm())}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-black transition ${
              editing === null
                ? "bg-[#d6a85f] hover:bg-[#e5bd7a]"
                : "border border-white/15 text-white/60 hover:text-white"
            }`}
          >
            {editing === null ? (
              <>
                <Plus size={14} /> Add photo
              </>
            ) : (
              <>
                <X size={14} /> Cancel
              </>
            )}
          </button>
        </div>
      </div>

      {actionError && (
        <Alert
          tone="error"
          title="Action failed"
          details={actionError.fieldErrors}
          className="mt-6"
        >
          {actionError.message}
        </Alert>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          noValidate
          className="mt-7 rounded-2xl border border-white/10 bg-[#111] p-6"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#d6a85f]">
            {editing === "new" ? "Add a gallery post" : `Edit #${editing.id}`}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Title
              </label>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((f) => ({ ...f, title: event.target.value }))
                }
                className={`${INPUT} mt-2`}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Style name
              </label>
              <input
                value={form.style_name}
                onChange={(event) =>
                  setForm((f) => ({ ...f, style_name: event.target.value }))
                }
                placeholder="e.g. Low Fade"
                className={`${INPUT} mt-2`}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((f) => ({ ...f, description: event.target.value }))
              }
              rows={2}
              className={`${INPUT} mt-2 resize-none`}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Image
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImageFile(event.target.files[0] || null)}
                className="mt-2 w-full text-xs text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-[#d6a85f] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black"
              />
            </div>

            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={() => setActive((value) => !value)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-[#5fb98a]/40 bg-[#5fb98a]/10 text-[#7fcfa4]"
                    : "border-white/15 text-white/50"
                }`}
              >
                {active ? "● Visible" : "○ Hidden"}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[#d6a85f] px-5 py-2 text-xs font-semibold text-black transition hover:bg-[#e5bd7a] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      )}

      <FieldError message={actionError?.fieldErrors?.title} />
      <FieldError message={actionError?.fieldErrors?.image} />

      {loading && (
        <div className="mt-8 flex justify-center rounded-2xl border border-white/10 bg-[#111] py-16">
          <Spinner label="Loading gallery..." />
        </div>
      )}

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
        <Alert tone="info" title="Nothing here yet" onRetry={load} className="mt-8">
          Add a photo to start the gallery.
        </Alert>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const busy = busyId === post.id;

            return (
              <article
                key={post.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]"
              >
                <div className="relative h-44">
                  {post.image ? (
                    <img
                      src={mediaUrl(post.image)}
                      alt={post.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#242424] to-[#0d0d0d] text-white/20">
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
                <div className="p-5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[#d6a85f]">
                    {post.style_name || "Recent work"}
                  </p>
                  <p className="mt-1 font-serif text-xl">{post.title}</p>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/45">
                    {post.description || "—"}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => openEdit(post)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white disabled:opacity-60"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleActive(post, !post.is_active)
                      }
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-white/70 transition hover:border-[#d6a85f]/50 hover:text-white disabled:opacity-60"
                    >
                      {busy ? "..." : post.is_active ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(post)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e05a4f]/40 px-3 py-2 text-[11px] font-semibold text-[#e0776b] transition hover:bg-[#e05a4f]/10 disabled:opacity-60"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
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
