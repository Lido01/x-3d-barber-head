import { useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";

import Alert from "../../components/ui/Alert";
import {
  AdminButton,
  AdminChip,
  AdminConfirmButton,
  AdminEmpty,
  AdminField,
  AdminInput,
  AdminLoading,
  AdminPageHeader,
  AdminSheet,
  AdminSwitch,
  AdminTextarea,
} from "../../components/admin/AdminUi";
import { EMPTY_LIST, invalidateQuery, useQuery } from "../../hooks/useQuery";
import { toArray } from "../../utils/toArray";
import {
  createQuickAnswer,
  deleteQuickAnswer,
  listAllQuickAnswers,
  updateQuickAnswer,
} from "../../services/quickAnswersApi";

/**
 * Saved quick answers for the AI assistant — GET/POST/PATCH/DELETE
 * /api/quick-answers/. Public visitors only ever read the active
 * rows; the assistant replies with them before calling the AI
 * provider, and the help screen lists them as FAQs.
 */

const BLANK = { question: "", answer: "", sort_order: 0 };

export default function AdminQuickAnswers() {
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [editing, setEditing] = useState(null); // null | "new" | row
  const [form, setForm] = useState(BLANK);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    data,
    loading,
    error,
    isFetching: refreshing,
    refetch: load,
  } = useQuery(
    "/quick-answers/",
    (signal) => listAllQuickAnswers({ signal }),
    { scope: "staff", select: toArray }
  );

  const rows = data || EMPTY_LIST;

  const refreshBothViews = () => invalidateQuery("/quick-answers/");

  const closeForm = () => {
    setEditing(null);
    setActionError(null);
  };

  const openNew = () => {
    setEditing("new");
    setForm(BLANK);
    setActive(true);
    setActionError(null);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      question: row.question,
      answer: row.answer,
      sort_order: row.sort_order ?? 0,
    });
    setActive(row.is_active);
    setActionError(null);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setActionError(null);

    if (!form.question.trim()) {
      setActionError({ message: "A question is required.", fieldErrors: {} });
      return;
    }

    if (!form.answer.trim()) {
      setActionError({ message: "An answer is required.", fieldErrors: {} });
      return;
    }

    setSaving(true);

    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      is_active: active,
      sort_order: Number(form.sort_order) || 0,
    };

    try {
      if (editing === "new") {
        await createQuickAnswer(payload);
      } else {
        await updateQuickAnswer(editing.id, payload);
      }

      closeForm();
      refreshBothViews();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    setBusyId(row.id);
    setActionError(null);

    try {
      await deleteQuickAnswer(row.id);
      refreshBothViews();
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (row, nextValue) => {
    setBusyId(row.id);
    setActionError(null);

    try {
      await updateQuickAnswer(row.id, { is_active: nextValue });
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
        eyebrow="Staff AI Management"
        title="Quick answers"
        description="Saved questions and answers the assistant replies with instantly, and that appear on the help page."
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
              {editing === null ? "Add answer" : "Cancel"}
            </AdminButton>
          </>
        }
      />

      {actionError && !editing && (
        <Alert tone="error" title="Action failed" details={actionError.fieldErrors}>
          {actionError.message}
        </Alert>
      )}

      {loading && <AdminLoading label="Loading quick answers..." />}

      {!loading && error && (
        <Alert tone="error" title="Could not load quick answers" details={error.fieldErrors} onRetry={load}>
          {error.message}
        </Alert>
      )}

      {!loading && !error && rows.length === 0 && (
        <AdminEmpty
          title="No saved answers yet"
          body="Add a question and answer so the assistant can reply instantly."
          onRetry={load}
          action={
            <AdminButton tone="primary" icon={Plus} onClick={openNew}>
              Add the first answer
            </AdminButton>
          }
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => {
            const busy = busyId === row.id;

            return (
              <li key={row.id}>
                <article className="rounded-2xl border border-console-line bg-console-raised p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-serif text-lg text-console-ink">{row.question}</p>
                      <p className="mt-1.5 text-[12px] leading-6 text-console-muted line-clamp-2">
                        {row.answer}
                      </p>
                    </div>

                    <AdminChip tone={row.is_active ? "good" : "neutral"}>
                      {row.is_active ? "Active" : "Hidden"}
                    </AdminChip>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-console-line pt-4">
                    <AdminButton size="sm" icon={Pencil} loading={busy} onClick={() => openEdit(row)}>
                      Edit
                    </AdminButton>

                    <AdminButton size="sm" loading={busy} onClick={() => handleToggleActive(row, !row.is_active)}>
                      {row.is_active ? "Hide" : "Activate"}
                    </AdminButton>

                    <AdminConfirmButton
                      size="sm"
                      icon={Trash2}
                      loading={busy}
                      message={`Delete "${row.question}"? This cannot be undone.`}
                      onConfirm={() => handleDelete(row)}
                    >
                      Delete
                    </AdminConfirmButton>
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
        title={editing === "new" ? "Add a quick answer" : "Edit quick answer"}
        description={
          editing === "new"
            ? "The assistant matches customer messages against saved questions."
            : `Editing #${editing?.id}.`
        }
        footer={
          <>
            <AdminButton onClick={closeForm} disabled={saving}>
              Cancel
            </AdminButton>

            <AdminButton type="submit" form="quick-answer-form" tone="primary" loading={saving}>
              {saving ? "Saving..." : "Save"}
            </AdminButton>
          </>
        }
      >
        {editing && (
          <form id="quick-answer-form" onSubmit={handleSave} noValidate className="space-y-4">
            {actionError && (
              <Alert tone="error" title="Could not save" details={actionError.fieldErrors}>
                {actionError.message}
              </Alert>
            )}

            <AdminField label="Question" required error={fieldError("question")}>
              <AdminInput
                value={form.question}
                invalid={Boolean(fieldError("question"))}
                placeholder="e.g. What are your opening hours?"
                onChange={(event) =>
                  setForm((f) => ({ ...f, question: event.target.value }))
                }
              />
            </AdminField>

            <AdminField label="Answer" required error={fieldError("answer")}>
              <AdminTextarea
                rows={4}
                value={form.answer}
                onChange={(event) =>
                  setForm((f) => ({ ...f, answer: event.target.value }))
                }
              />
            </AdminField>

            <AdminField label="Sort order" hint="Smaller values show first.">
              <AdminInput
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(event) =>
                  setForm((f) => ({ ...f, sort_order: event.target.value }))
                }
              />
            </AdminField>

            <div className="rounded-xl border border-console-line bg-console-sunken p-3.5">
              <AdminSwitch
                checked={active}
                onChange={setActive}
                label={active ? "Active" : "Hidden"}
                description={
                  active
                    ? "The assistant and help page use this answer."
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
