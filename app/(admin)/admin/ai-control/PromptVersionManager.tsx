"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { manageAiPrompt, type PromptActionState } from "./actions";

type PromptVersion = {
  id: string;
  version: number;
  prompt: string;
  publishedAt: string | null;
};

type PromptDraft = {
  id: string;
  version: number;
  prompt: string;
  tested: boolean;
  testedAt: string | null;
  testedModel: string | null;
  createdAt: string;
};

type PromptHistoryItem = {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  createdAt: string;
  publishedAt: string | null;
  testedModel: string | null;
};

type PromptState = {
  current: PromptVersion | null;
  draft: PromptDraft | null;
  history: PromptHistoryItem[];
};

const initialState: PromptActionState = { status: "idle", message: "" };
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export default function PromptVersionManager({
  toolKey,
  toolLabel,
  promptState,
  canManage,
}: {
  toolKey: string;
  toolLabel: string;
  promptState: PromptState;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(manageAiPrompt, initialState);
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [promptText, setPromptText] = useState(promptState.draft?.prompt ?? "");
  const savedPrompt = state.savedPrompt ?? promptState.draft?.prompt ?? "";

  const draftId = state.draftId ?? promptState.draft?.id ?? "";
  const isTested = promptText === savedPrompt && (state.tested ?? promptState.draft?.tested ?? false);
  const previousPublished = promptState.history.some(
    (item) => item.status === "archived" && item.publishedAt !== null,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <>
      <article className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900 md:px-5">
        <div className="min-w-0">
          <h3 className="font-semibold">{toolLabel}</h3>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            {promptState.current ? `Published version v${promptState.current.version}` : "Using code-defined prompt"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {promptState.draft && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${promptState.draft.tested ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"}`}>
              Draft v{promptState.draft.version} · {promptState.draft.tested ? "tested" : "needs test"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-haspopup="dialog"
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:border-emerald-700 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-stone-700 dark:text-stone-100 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
          >
            Manage prompt
          </button>
        </div>
      </article>

      <dialog
        ref={dialogRef}
        aria-labelledby={`prompt-dialog-title-${toolKey}`}
        aria-describedby={`prompt-dialog-description-${toolKey}`}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="fixed inset-0 m-auto max-h-[min(90dvh,56rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/60 backdrop:backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 md:px-7">
          <div>
            <h2 id={`prompt-dialog-title-${toolKey}`} className="text-lg font-semibold">{toolLabel} prompt</h2>
            <p id={`prompt-dialog-description-${toolKey}`} className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              {promptState.current ? `Published version v${promptState.current.version}` : "Using the code-defined prompt"}
              {promptState.draft ? ` · Draft v${promptState.draft.version}` : " · No saved draft"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close prompt manager"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-300 text-xl leading-none text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-5 md:p-7">

      {promptState.current && (
        <details className="mt-4 rounded-xl bg-stone-50 p-4 text-sm dark:bg-stone-950">
          <summary className="w-fit cursor-pointer font-medium">View published prompt v{promptState.current.version}</summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans leading-6">{promptState.current.prompt}</pre>
        </details>
      )}

      {canManage ? (
        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="toolKey" value={toolKey} />
          <input type="hidden" name="versionId" value={draftId} />
          <label className="block text-sm font-medium">
            Draft teaching guidance
            <textarea
              name="prompt"
              required
              maxLength={6000}
              value={promptText}
              onChange={(event) => {
                setPromptText(event.target.value);
              }}
              placeholder="Example: Use short explanations and include one familiar Filipino context when it helps."
              className="mt-2 min-h-36 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 dark:border-stone-700 dark:bg-stone-950"
            />
            <span className="mt-1 block text-xs font-normal text-stone-500">1–6000 characters. Mandatory LuminaPH system instructions stay in code and take priority over this optional guidance.</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button name="intent" value="save" disabled={pending} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800">Save draft</button>
            <button name="intent" value="test" disabled={pending} className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">Save & test</button>
            <button name="intent" value="publish" disabled={pending || !draftId || !isTested} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Publish tested draft</button>
            <button name="intent" value="rollback" disabled={pending || !promptState.current || !previousPublished} className="rounded-xl border border-amber-400 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950">Restore previous version</button>
          </div>
          <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">Testing sends a fixed, synthetic study request to the selected Groq route and may use provider quota. Student prompts or private learning data are not included.</p>
        </form>
      ) : (
        <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">Only a Super Admin can edit, test, publish, or restore prompt versions.</p>
      )}

      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"}`}>
          {state.message}
        </p>
      )}
      {state.preview && (
        <section className="mt-4 rounded-xl border border-emerald-200 p-4 dark:border-emerald-900">
          <h4 className="text-sm font-semibold">Synthetic preview</h4>
          <pre className="mt-2 whitespace-pre-wrap text-sm leading-6">{state.preview}</pre>
        </section>
      )}

      {promptState.history.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="w-fit cursor-pointer font-medium">Version history ({promptState.history.length})</summary>
          <ol className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 dark:divide-stone-700 dark:border-stone-700">
            {promptState.history.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>v{item.version} · {item.status}{item.testedModel ? ` · tested on ${item.testedModel}` : ""}</span>
                <time className="text-xs text-stone-500 dark:text-stone-400" dateTime={item.publishedAt ?? item.createdAt}>{dateFormatter.format(new Date(item.publishedAt ?? item.createdAt))}</time>
              </li>
            ))}
          </ol>
        </details>
      )}
        </div>
      </dialog>
    </>
  );
}
