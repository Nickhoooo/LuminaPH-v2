"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";

export default function NoticeDialog({
  title,
  message,
  open,
  onClose,
}: {
  title: string;
  message: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-110 rounded-2xl border border-[#e4e9dc] dark:border-stone-700 bg-[#fdfefb] dark:bg-stone-800 p-8 text-[#233d34] dark:text-stone-200 shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute right-4 top-4 grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        <X size={20} />
      </button>
      <span className="grid size-14 place-items-center rounded-xl bg-[#eff3e9] dark:bg-stone-800 text-[#779061] dark:text-stone-200">
        <Sparkles size={24} />
      </span>
      <h2 className="mb-3 mt-6 break-words font-serif text-3xl">{title}</h2>
      <p className="mb-6 break-words text-sm leading-7 text-stone-500 dark:text-stone-400">
        {message}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-[#245c47] px-4 py-3 text-xs font-semibold text-white hover:bg-[#194734]"
      >
        Got it <ArrowRight size={16} />
      </button>
    </dialog>
  );
}
