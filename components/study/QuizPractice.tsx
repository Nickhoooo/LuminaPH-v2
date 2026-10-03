"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, RotateCcw, X } from "lucide-react";
import { submitQuiz, type QuizAttemptState } from "@/app/(student)/study-tools/quizzes/actions";

type Question = { question: string; choices: string[] };

export default function QuizPractice({ studySetId, questions }: { studySetId: string; questions: Question[] }) {
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));
  const [submission, setSubmission] = useState<{ id: string; answers: number[] } | null>(null);
  const [completed, setCompleted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, action, pending] = useActionState(async (previous: QuizAttemptState, data: FormData) => {
    // Freeze ID and answers so a retry confirms the same attempt instead of duplicating it.
    const attempt = submission ?? { id: crypto.randomUUID(), answers: [...answers] };
    setSubmission(attempt);
    data.set("attemptId", attempt.id);
    data.set("answers", JSON.stringify(attempt.answers));
    try {
      const next = await submitQuiz(previous, data);
      if (next.status === "success") setCompleted(true);
      return next;
    } catch {
      return { status: "error" as const, message: "Connection interrupted. Retry the same submission to confirm your result." };
    }
  }, { status: "idle", message: "" } as QuizAttemptState);
  useEffect(() => { if (completed) heading.current?.focus(); }, [completed]);
  useEffect(() => {
    if (!completed) questionHeading.current?.focus({ preventScroll: true });
  }, [questionIndex, completed]);
  const currentQuestion = questions[questionIndex];
  const answeredCount = answers.filter(answer => answer >= 0).length;
  const isLastQuestion = questionIndex === questions.length - 1;
  const button = "inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50";

  if (completed && state.result) {
    const result = state.result;
    return <section className="space-y-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6">
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">Quiz complete</h2>
      <p className="text-3xl font-semibold text-emerald-800 dark:text-emerald-200">{result.score}/{result.questionCount} · {Math.round(result.score / result.questionCount * 100)}%</p>
      <p className="text-sm text-stone-600 dark:text-stone-300">Your attempt is saved. Review the explanations below; AI answer keys can contain mistakes.</p>
      <ol className="space-y-4">{result.questions.map((question, i) => {
        const correct = result.answers[i] === question.correctIndex;
        return <li key={i} className={"rounded-xl border p-4 " + (correct ? "border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950" : "border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950")}>
          <p className="flex items-center gap-2 text-sm font-semibold">{correct ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}{correct ? "Correct" : "Needs review"}</p>
          <h3 className="mt-2 font-medium">{i + 1}. {question.question}</h3>
          <p className="mt-2 text-sm">Your answer: {question.choices[result.answers[i]]}</p>
          {!correct && <p className="mt-1 text-sm font-medium">Correct answer: {question.choices[question.correctIndex]}</p>}
          <p className="mt-2 text-sm leading-6">{question.explanation}</p>
        </li>;
      })}</ol>
      <button type="button" className={button} onClick={() => { setAnswers(questions.map(() => -1)); setSubmission(null); setQuestionIndex(0); setCompleted(false); }}><RotateCcw size={17} aria-hidden="true" />Retake quiz</button>
      <p className="text-xs text-stone-500 dark:text-stone-400">Retaking uses no AI generation attempts. Your previous score stays saved.</p>
    </section>;
  }
  if (!currentQuestion) return <p role="alert">This quiz has no readable questions.</p>;

  return <form action={action} onSubmit={event => {
    if (!isLastQuestion || answeredCount !== questions.length || pending) event.preventDefault();
  }} className="mx-auto max-w-3xl space-y-4" aria-busy={pending}>
    <input type="hidden" name="studySetId" value={studySetId} />
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="font-semibold text-emerald-800 dark:text-emerald-200" role="status">Question {questionIndex + 1} of {questions.length}</p>
      <p className="text-stone-500 dark:text-stone-400">{answeredCount}/{questions.length} answered</p>
    </div>
    <progress value={answeredCount} max={questions.length} aria-label="Questions answered" className="block h-1.5 w-full overflow-hidden rounded-full accent-emerald-700" />
    <article className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm">
      <div className="border-b border-stone-200 dark:border-stone-700 bg-[#eee6d5] dark:bg-stone-800 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">Choose one answer</div>
      <div className="space-y-6 p-5 sm:p-7">
        <h2 ref={questionHeading} tabIndex={-1} id="quiz-question-heading" className="break-words text-xl font-medium leading-relaxed outline-none sm:text-2xl">{currentQuestion.question}</h2>
        <fieldset key={questionIndex} aria-labelledby="quiz-question-heading" disabled={pending || submission !== null} className="space-y-3">
          {currentQuestion.choices.map((choice, j) => <label key={j} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors motion-reduce:transition-none sm:p-4 " + (answers[questionIndex] === j ? "border-emerald-700 bg-emerald-50 dark:bg-emerald-950" : "border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800")}>
            <input type="radio" name={`answer-${questionIndex}`} required checked={answers[questionIndex] === j} onChange={() => setAnswers(previous => previous.map((value, index) => index === questionIndex ? j : value))} className="mt-1 accent-emerald-800" />
            <span className="shrink-0 font-semibold text-emerald-800 dark:text-emerald-200">{String.fromCharCode(65 + j)}.</span>
            <span className="min-w-0 break-words text-sm leading-6">{choice}</span>
          </label>)}
        </fieldset>
      </div>
    </article>
    {submission && <p className="text-sm text-stone-600 dark:text-stone-300">Answers are locked for this submission. Retry to confirm the same attempt if the connection failed.</p>}
    <p role="status" className="text-sm text-red-700 dark:text-red-200">{state.status === "error" ? state.message : ""}</p>
    <nav aria-label="Quiz questions" className="flex items-center justify-between gap-3">
      <button type="button" disabled={questionIndex === 0 || pending || submission !== null} onClick={() => setQuestionIndex(previous => previous - 1)} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40"><ArrowLeft size={17} aria-hidden="true" />Previous</button>
      {isLastQuestion ? <button type="submit" disabled={pending || answeredCount !== questions.length} className={button}>{pending && <LoaderCircle size={17} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}{pending ? "Checking answers…" : submission ? "Retry submission" : "Submit quiz"}</button> : <button type="button" disabled={pending || answers[questionIndex] < 0} onClick={() => setQuestionIndex(previous => previous + 1)} className={button}>Next<ArrowRight size={17} aria-hidden="true" /></button>}
    </nav>
    <p className="text-xs text-stone-500 dark:text-stone-400">{answers[questionIndex] < 0 ? "Select an answer to continue. " : ""}You can go back to change answers before submitting. Explanations appear with your results.</p>
  </form>;
}
