"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { submitGroupQuiz } from "../group-quiz-actions";
import type { GroupQuizQuestion, GroupQuizResult } from "../group-quiz-types";

export default function GroupQuizPractice({
  groupId,
  quizId,
  questions,
  initialResult,
}: {
  groupId: string;
  quizId: string;
  questions: GroupQuizQuestion[];
  initialResult?: GroupQuizResult;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    questions.map(() => null),
  );
  const [result, setResult] = useState(initialResult);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [frozen, setFrozen] = useState(false);
  const submission = useRef<{ id: string; answers: number[] } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const quizUrl = `/study-tools/study-groups/${groupId}/quizzes/${quizId}`;
  const button =
    "inline-flex items-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50";

  async function submit() {
    if (pending) return;
    if (answers.some((answer) => answer === null)) {
      setMessage("Answer every question before submitting.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      // Freeze both the ID and choices, so a network retry cannot become a new attempt.
      submission.current ??= {
        id: crypto.randomUUID(),
        answers: answers as number[],
      };
      setFrozen(true);
      const form = new FormData();
      form.set("groupId", groupId);
      form.set("quizId", quizId);
      form.set("attemptId", submission.current.id);
      form.set("answers", JSON.stringify(submission.current.answers));
      const response = await submitGroupQuiz(form);
      setMessage(response.message);
      if (response.status === "success" && response.result) {
        setResult(response.result);
      }
    } catch {
      setMessage(
        "Connection interrupted. Retry this submission with your saved choices.",
      );
    } finally {
      setPending(false);
    }
  }

  function retake() {
    submission.current = null;
    setAnswers(questions.map(() => null));
    setIndex(0);
    setFrozen(false);
    setMessage("");
    setResult(undefined);
  }

  if (result) {
    return (
      <section className="space-y-5" aria-label="Quiz result">
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-6">
          <h2 className="text-2xl font-semibold text-emerald-950 dark:text-emerald-200">
            Quiz complete · {result.score}/{result.questionCount}
          </h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            Your result is saved. Your group sees completion, while your score
            and answers stay private.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={retake} className={button}>
              Retake quiz
            </button>
            <Link
              href={`${quizUrl}?attempt=${result.attemptId}`}
              className={button}
            >
              Open saved result
            </Link>
          </div>
          <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
            Retakes reuse this quiz and do not use AI generation attempts.
          </p>
        </div>
        {!result.review ? (
          <p role="status">
            Your score is saved. Open the saved result to reload explanations.
          </p>
        ) : (
          <ol className="space-y-3">
            {result.review.map((question, position) => {
              const correct =
                result.answers[position] === question.correctIndex;
              return (
                <li
                  key={position}
                  className={`rounded-xl border p-5 ${correct ? "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900" : "border-rose-200 bg-rose-50"}`}
                >
                  <h3 className="flex gap-2 font-medium">
                    {correct ? (
                      <Check
                        className="shrink-0 text-emerald-700 dark:text-emerald-200"
                        size={18}
                        aria-hidden="true"
                      />
                    ) : (
                      <X
                        className="shrink-0 text-rose-700"
                        size={18}
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {position + 1}. {question.question}
                    </span>
                  </h3>
                  <p className="mt-2 text-sm">
                    {correct ? "Correct" : "Review this question"} · Your
                    answer: {question.choices[result.answers[position]]}
                  </p>
                  {!correct && (
                    <p className="mt-1 text-sm font-medium">
                      Correct answer: {question.choices[question.correctIndex]}
                    </p>
                  )}
                  <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
                    {question.explanation}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    );
  }

  const question = questions[index];
  return (
    <section className="space-y-4" aria-busy={pending}>
      <div className="flex justify-between gap-3 text-sm text-stone-500 dark:text-stone-400">
        <p aria-live="polite">
          Question {index + 1} of {questions.length}
        </p>
        <p>
          {answers.filter((answer) => answer !== null).length}/
          {questions.length} answered
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 sm:p-8">
        <h2
          ref={heading}
          tabIndex={-1}
          id="group-quiz-question"
          className="break-words text-xl font-semibold outline-none"
        >
          {question.question}
        </h2>
        <fieldset
          disabled={pending || frozen}
          aria-labelledby="group-quiz-question"
          className="mt-6 space-y-3"
        >
          {question.choices.map((choice, position) => (
            <label
              key={`${index}-${position}`}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${answers[index] === position ? "border-emerald-700 bg-emerald-50 dark:bg-emerald-950" : "border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
            >
              <input
                type="radio"
                name={`question-${index}`}
                checked={answers[index] === position}
                onChange={() =>
                  setAnswers((previous) =>
                    previous.map((answer, i) =>
                      i === index ? position : answer,
                    ),
                  )
                }
                className="mt-1 accent-emerald-700"
              />
              <span className="text-sm leading-6">
                <strong className="mr-2">
                  {String.fromCharCode(65 + position)}.
                </strong>
                {choice}
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          disabled={pending || index === 0}
          onClick={() => {
            setIndex(index - 1);
            heading.current?.focus();
          }}
          className={button}
        >
          Previous
        </button>
        {index < questions.length - 1 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setIndex(index + 1);
              heading.current?.focus();
            }}
            className={button}
          >
            Next question
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending || answers.some((answer) => answer === null)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            {pending && (
              <LoaderCircle
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />
            )}
            {pending
              ? "Submitting…"
              : frozen
                ? "Retry submission"
                : "Submit quiz"}
          </button>
        )}
      </div>
      {frozen && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Your choices are locked for this submission. Retry if the result was
          not confirmed.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-red-700 dark:text-red-200">
          {message}
        </p>
      )}
    </section>
  );
}
