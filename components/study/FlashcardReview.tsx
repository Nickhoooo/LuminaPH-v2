"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Eye, RotateCcw, X } from "lucide-react";
import type { Flashcard } from "@/lib/ai/flashcards";

export default function FlashcardReview({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [ratings, setRatings] = useState<Record<number, "known" | "missed">>({});
  // Snapshot the review queue so marking a missed card as known does not skip a card.
  const [reviewQueue, setReviewQueue] = useState<number[] | null>(null);
  const [finished, setFinished] = useState(false);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (finished) resultsHeading.current?.focus();
  }, [finished]);
  const answerId = useId();
  const queue = reviewQueue ?? cards.map((_, i) => i);
  const cardIndex = queue[index];
  const card = cards[cardIndex];
  const missed = cards.map((_, i) => i).filter((i) => ratings[i] === "missed");
  const knownCount = Object.values(ratings).filter((rating) => rating === "known").length;
  const ratedCount = Object.keys(ratings).length;

  function resumeUnrated() {
    setReviewQueue(null);
    setIndex(cards.findIndex((_, i) => !ratings[i]));
    setRevealed(false);
    setFinished(false);
  }

  function rate(value: "known" | "missed") {
    if (!revealed) return;
    setRatings((previous) => ({ ...previous, [cardIndex]: value }));
  }

  function reviewMissed() {
    if (missed.length === 0) return;
    setReviewQueue(missed);
    setFinished(false);
    setIndex(0);
    setRevealed(false);
  }

  function restart() {
    setFinished(false);
    setRatings({});
    setReviewQueue(null);
    setIndex(0);
    setRevealed(false);
  }

  function navigate(next: number) {
    if (next < 0 || next >= queue.length) return;
    setIndex(next);
    setRevealed(false);
  }

  async function copyDeck() {
    setCopied(false);
    try {
      const text = cards.map((item, i) => `${i + 1}. ${item.question}\n${item.answer}`).join("\n\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyMessage("All cards copied.");
    } catch {
      setCopyMessage("Copy was unavailable. Expand the text version below to select and copy it.");
    }
  }

  if (!card) return <p role="alert">This deck has no readable cards.</p>;

  let CopyIcon = Copy;
  let copyLabel = "Copy all cards";
  if (copied) { CopyIcon = Check; copyLabel = "Copied"; }
  let revealLabel = "Reveal answer";
  if (revealed) revealLabel = "Hide answer";
  const buttonStyle = "inline-flex items-center gap-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section aria-label="Flashcard review" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-stone-600 dark:text-stone-300">{finished ? "Review results" : <>Card {index + 1} of {queue.length}{reviewQueue && " · Missed-card practice"}</>}</p>
        <button type="button" onClick={copyDeck} className={buttonStyle}><CopyIcon size={16} aria-hidden="true" />{copyLabel}</button>
      </div>
      <p role="status" className="text-sm text-stone-600 dark:text-stone-300">{copyMessage}</p>
      {finished ? <section aria-labelledby="flashcard-results-heading" className="space-y-5 rounded-2xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-stone-900 p-6 sm:p-8">
        <div>
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{reviewQueue ? "Practice round finished" : "Session finished"}</p>
          <h3 id="flashcard-results-heading" ref={resultsHeading} tabIndex={-1} className="mt-2 text-2xl font-semibold outline-none">Here’s how you did</h3>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">Your latest self-check marks across the whole deck. Unrated cards are not counted as mistakes.</p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 p-3"><dt className="text-sm text-emerald-800 dark:text-emerald-200">Known</dt><dd className="mt-1 text-2xl font-semibold">{knownCount}</dd></div>
          <div className="rounded-xl bg-red-50 dark:bg-red-950 p-3"><dt className="text-sm text-red-700 dark:text-red-200">Needs review</dt><dd className="mt-1 text-2xl font-semibold">{missed.length}</dd></div>
          <div className="rounded-xl bg-stone-100 dark:bg-stone-800 p-3"><dt className="text-sm text-stone-600 dark:text-stone-300">Unrated</dt><dd className="mt-1 text-2xl font-semibold">{cards.length - ratedCount}</dd></div>
        </dl>
        <p className="font-medium">{ratedCount === 0 ? "No cards rated yet." : <>Self-check score: {knownCount}/{ratedCount} rated cards ({Math.round(knownCount / ratedCount * 100)}%).</>}</p>
        {ratedCount < cards.length && <p className="text-sm text-stone-600 dark:text-stone-300">Rate the remaining cards for a complete deck score.</p>}
        {missed.length > 0 && <div><h4 className="font-semibold text-red-700 dark:text-red-200">Cards to review</h4><ul className="mt-3 space-y-3">{missed.map((i) => <li key={i} className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950 p-4"><p className="text-sm font-medium">{i + 1}. {cards[i].question}</p><p className="mt-2 text-sm text-stone-700 dark:text-stone-200">Answer: {cards[i].answer}</p></li>)}</ul></div>}
        <div className="flex flex-wrap gap-3">
          {missed.length > 0 && <button type="button" onClick={reviewMissed} className={buttonStyle}>Review missed ({missed.length})</button>}
          {ratedCount < cards.length && <button type="button" onClick={resumeUnrated} className={buttonStyle}>Rate remaining cards</button>}
          <button type="button" onClick={restart} className={buttonStyle}><RotateCcw size={17} aria-hidden="true" />Start again</button>
        </div>
      </section> : <>
      <div className="space-y-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
        <p className="text-sm font-medium" role="status" aria-live="polite">Self-check: {knownCount} known / {ratedCount} rated · {missed.length} to review · {cards.length - ratedCount} unrated</p>
        <p className="text-xs text-stone-500 dark:text-stone-400">Reveal the answer, then mark whether you recalled it. Your latest mark counts once per card; this is not automatic grading.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={missed.length === 0} onClick={reviewMissed} className={buttonStyle}>Review missed ({missed.length})</button>
          {reviewQueue && <button type="button" onClick={() => { setReviewQueue(null); setIndex(0); setRevealed(false); }} className={buttonStyle}>Back to all cards</button>}
        </div>
        {ratedCount === cards.length && <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">All cards rated. Current self-check score: {knownCount}/{cards.length} ({Math.round(knownCount / cards.length * 100)}%).</p>}
      </div>
      <article className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm">
        <div className="border-b border-stone-200 dark:border-stone-700 bg-[#eee6d5] dark:bg-stone-800 px-6 py-4 text-xs font-semibold uppercase tracking-wider">
          {ratings[cardIndex] === "missed" && <span className="inline-flex items-center gap-2 text-red-700 dark:text-red-200"><X size={16} aria-hidden="true" />Needs review</span>}
          {ratings[cardIndex] === "known" && <span className="inline-flex items-center gap-2 text-emerald-800 dark:text-emerald-200"><Check size={16} aria-hidden="true" />You knew this</span>}
          {!ratings[cardIndex] && "Think first, then reveal"}
        </div>
        <div className="min-h-64 space-y-6 p-6 sm:p-8">
          <h3 className="whitespace-pre-wrap break-words text-xl font-medium leading-relaxed sm:text-2xl">{card.question}</h3>
          <div id={answerId} aria-live="polite" aria-atomic="true">
            {revealed && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4"><p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-200">Answer</p><p className="mt-2 whitespace-pre-wrap break-words leading-7 text-emerald-950 dark:text-emerald-200">{card.answer}</p></div>}
          </div>
          <button type="button" onClick={() => setRevealed((previous) => !previous)} aria-expanded={revealed} aria-controls={answerId} className={buttonStyle}><Eye size={17} aria-hidden="true" />{revealLabel}</button>
          {revealed && <div className="flex flex-wrap gap-3" role="group" aria-label="Did you recall the answer?">
            <button type="button" aria-pressed={ratings[cardIndex] === "known"} onClick={() => rate("known")} className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 aria-pressed:bg-emerald-100 dark:aria-pressed:bg-emerald-950"><Check size={18} aria-hidden="true" />I knew it</button>
            <button type="button" aria-pressed={ratings[cardIndex] === "missed"} onClick={() => rate("missed")} className="inline-flex items-center gap-2 rounded-lg border border-red-600 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950 aria-pressed:bg-red-100 dark:aria-pressed:bg-red-950"><X size={18} aria-hidden="true" />Need review</button>
          </div>}
        </div>
      </article>
      <nav aria-label="Flashcard navigation" className="flex flex-wrap justify-between gap-3">
        <button type="button" disabled={index === 0} onClick={() => navigate(index - 1)} className={buttonStyle}><ArrowLeft size={17} aria-hidden="true" />Previous</button>
        <button type="button" onClick={restart} className={buttonStyle}><RotateCcw size={17} aria-hidden="true" />Reset session</button>
        {index === queue.length - 1 ? <button type="button" onClick={() => setFinished(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800"><Check size={17} aria-hidden="true" />Done</button> : <button type="button" onClick={() => navigate(index + 1)} className={buttonStyle}>Next<ArrowRight size={17} aria-hidden="true" /></button>}
      </nav>
      </>}
      <details className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
        <summary className="cursor-pointer text-sm font-medium">Text version — all questions and answers</summary>
        <ol className="mt-4 list-decimal space-y-4 pl-5">
          {cards.map((item, i) => <li key={i} className={"whitespace-pre-wrap break-words rounded-lg p-3 " + (ratings[i] === "missed" ? "bg-red-50 dark:bg-red-950 ring-1 ring-red-200" : "")}>
            {ratings[i] === "missed" && <span className="flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-200"><X size={14} aria-hidden="true" />Needs review</span>}
            <p className="font-medium">{item.question}</p><p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">{item.answer}</p>
          </li>)}
        </ol>
      </details>
      <p className="text-xs text-stone-500 dark:text-stone-400">AI-generated cards can contain mistakes. Check important details against your class materials. Marks and score apply to this session only and reset when you leave or reset the session. Reviewing uses no AI attempts.</p>
    </section>
  );
}
