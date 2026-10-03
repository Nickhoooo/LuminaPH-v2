"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import StudyContent from "@/components/study/StudyContent";
import { useStudyPreferences } from "@/components/study/StudyPreferencesProvider";
import { askTutor, type TutorState } from "./actions";

type ChatTurn = NonNullable<TutorState["turn"]>;

type TutorChatProps = {
  guide: { id: string; title: string };
  savedTurns: ChatTurn[];
  historyPage: number;
};

const quickPrompts = [
  { label: "Explain simply", question: "Explain the main idea of this lesson in simpler terms." },
  { label: "Give an example", question: "Give me a practical example of the main concept in this lesson." },
  { label: "Give me a hint", question: "Give me a practice question about this lesson and a hint, without revealing the answer yet." },
];

export default function TutorChat({ guide, savedTurns, historyPage }: TutorChatProps) {
  const preferences = useStudyPreferences();
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState(preferences.language);
  const [localTurns, setLocalTurns] = useState<ChatTurn[]>([]);
  const request = useRef<{ id: string; question: string; language: string } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const latestReply = useRef<HTMLDivElement>(null);

  const [state, action, pending] = useActionState(
    async (previous: TutorState, data: FormData): Promise<TutorState> => {
      const submittedQuestion = String(data.get("question") ?? "").trim();
      const submittedLanguage = String(data.get("language") ?? "");

      // Keep the message ID on retries. Changed questions get a new ID.
      if (
        !request.current ||
        request.current.question !== submittedQuestion ||
        request.current.language !== submittedLanguage
      ) {
        request.current = {
          id: crypto.randomUUID(),
          question: submittedQuestion,
          language: submittedLanguage,
        };
      }
      data.set("turnId", request.current.id);

      try {
        const next = await askTutor(previous, data);
        if (next.turn) {
          const turn = next.turn;
          setLocalTurns(turns => [...turns.filter(item => item.id !== turn.id), turn]);
          if (turn.saved) {
            setQuestion("");
            request.current = null;
          }
        }
        return next;
      } catch {
        return {
          status: "error",
          message: "Connection interrupted. Retry the same question to check for a saved reply. An unfinished earlier request may still count as a chat attempt.",
        };
      }
    },
    { status: "idle", message: "" } as TutorState,
  );

  const savedIds = new Set(savedTurns.map(turn => turn.id));
  const turns = [...savedTurns, ...localTurns.filter(turn => !savedIds.has(turn.id))];
  const unsavedReply = turns.find(turn => !turn.saved);
  const isLatestPage = historyPage === 1;

  useEffect(() => {
    if (state.turn) latestReply.current?.focus();
  }, [state.turn]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Studying together</p>
        <h2 className="mt-2 break-words text-xl font-semibold">{guide.title}</h2>
        <Link href={"/library/" + guide.id} className="mt-3 inline-flex rounded-lg border border-emerald-800/25 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950">
          Back to lesson
        </Link>
      </div>

      {turns.length === 0 && (
        <p className="rounded-2xl bg-[#edf1e6] dark:bg-stone-800 p-6 text-sm leading-6 text-stone-600 dark:text-stone-300">
          What would you like to understand? Ask about a concept, request an example, or try a practice hint.
        </p>
      )}

      <ol aria-label="Conversation" className="space-y-6">
        {turns.map(turn => (
          <li key={turn.id} className="space-y-3">
            <div className="ml-6 rounded-2xl bg-emerald-800 p-4 text-white sm:ml-16">
              <p className="mb-2 text-xs font-semibold">You</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{turn.question}</p>
            </div>
            <div className="mr-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 sm:mr-10">
              <p className="mb-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">LuminaPH Tutor</p>
              <StudyContent content={turn.answer} />
              <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">{turn.saved ? "Saved to this conversation" : "Save not confirmed — keep a copy"}</p>
            </div>
          </li>
        ))}
      </ol>

      <div ref={latestReply} tabIndex={-1} role="status" className="text-sm outline-none">
        <p className={state.status === "error" ? "text-red-700 dark:text-red-200" : "text-emerald-800 dark:text-emerald-200"}>
          {pending ? "Tutor is preparing a reply…" : state.message}
        </p>
      </div>

      {unsavedReply && (
        <div className="space-y-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-4">
          <label className="block text-sm font-medium">
            Copy this exchange before reloading
            <textarea
              readOnly
              rows={6}
              value={`You: ${unsavedReply.question}\n\nTutor: ${unsavedReply.answer}`}
              onFocus={event => event.target.select()}
              className="mt-2 w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 text-sm"
            />
          </label>
          <p className="text-xs leading-6">Reload to check whether this reply saved before continuing. Unsaved replies are not included in the tutor’s next conversation context.</p>
        </div>
      )}

      {isLatestPage && !unsavedReply && (
        <form action={action} aria-busy={pending} className="space-y-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5">
          <input type="hidden" name="studySetId" value={guide.id} />
          <fieldset disabled={pending} className="space-y-4">
            <legend className="sr-only">Ask about this lesson</legend>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map(prompt => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => { setQuestion(prompt.question); input.current?.focus(); }}
                  className="rounded-full border border-emerald-800/20 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-50"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
            <label className="block text-sm font-medium">
              Your question
              <textarea
                ref={input}
                name="question"
                required
                maxLength={2000}
                rows={3}
                value={question}
                onChange={event => setQuestion(event.target.value)}
                placeholder="Which part of this lesson would you like to discuss?"
                className="mt-2 w-full rounded-xl border border-stone-300 dark:border-stone-700 p-3 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              Explanation language
              <select name="language" value={language} onChange={event => setLanguage(event.target.value)} className="ml-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-2 text-sm">
                <option value="english">English</option>
                <option value="filipino">Filipino</option>
                <option value="taglish">Taglish</option>
              </select>
            </label>
          </fieldset>
          <button disabled={pending || !question.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50">
            {pending ? <LoaderCircle size={17} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Send size={17} aria-hidden="true" />}
            {pending ? "Sending…" : "Send question"}
          </button>
          <p className="text-xs leading-6 text-stone-500 dark:text-stone-400">The guide and up to 6 recent exchanges are sent to our AI provider. Standard allowance: 20 chat attempts per 24 hours, 10 seconds apart; failed AI requests count. Developer accounts bypass app limits. Provider limits still apply.</p>
        </form>
      )}
      {!isLatestPage && (
        <Link href={"/study-tools/ai-tutor?guide=" + guide.id} className="inline-flex rounded-xl bg-emerald-800 px-4 py-3 text-sm text-white">Return to latest messages to continue chatting</Link>
      )}
      <p className="text-xs text-stone-500 dark:text-stone-400">AI replies can contain mistakes. Check important details against your class materials.</p>
    </section>
  );
}
