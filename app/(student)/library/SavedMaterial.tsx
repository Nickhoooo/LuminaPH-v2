"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import StudyContent from "@/components/study/StudyContent";

export default function SavedMaterial({
  content,
  isStudyGuide,
}: {
  content: string;
  isStudyGuide: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  async function copyMaterial() {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(body.current?.innerText || content);
      setCopied(true);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Copy was unavailable. Select the text and copy it manually.");
    }
  }

  let Icon = Copy;
  let label = "Copy material";
  if (copied) {
    Icon = Check;
    label = "Copied";
  }

  return (
    <article className="min-w-0 space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 sm:p-7">
      <button
        type="button"
        onClick={copyMaterial}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950"
      >
        <Icon size={16} aria-hidden="true" />
        {label}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-stone-600 dark:text-stone-300">
        {message}
      </p>
      {isStudyGuide && (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950 p-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
          AI-generated study guide. Check important details against your class
          materials; AI can make mistakes.
        </p>
      )}
      {isStudyGuide && <StudyContent content={content} contentRef={body} />}
      {!isStudyGuide && (
        <div
          ref={body}
          className="whitespace-pre-wrap break-words text-sm leading-7 text-stone-800 dark:text-stone-200"
        >
          {content}
        </div>
      )}
    </article>
  );
}
