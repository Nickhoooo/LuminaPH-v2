import type { QuizQuestion } from "@/lib/ai/quizzes";

// The quiz-taking screen receives no answer keys or explanations.
export type GroupQuizQuestion = Pick<QuizQuestion, "question" | "choices">;

export type GroupQuizResult = {
  attemptId: string;
  score: number;
  questionCount: number;
  answers: number[];
  review?: QuizQuestion[];
};

export type GroupQuizAttemptState = {
  status: "error" | "success";
  message: string;
  result?: GroupQuizResult;
};

export function readGroupQuizQuestions(value: unknown): GroupQuizQuestion[] {
  if (!Array.isArray(value) || ![5, 10].includes(value.length)) {
    throw new Error("Invalid quiz questions.");
  }
  return value.map((item: unknown) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("question" in item) ||
      typeof item.question !== "string" ||
      !item.question.trim() ||
      item.question.length > 500 ||
      !("choices" in item) ||
      !Array.isArray(item.choices) ||
      item.choices.length !== 4
    ) {
      throw new Error("Invalid question.");
    }
    const choices = item.choices.map((choice: unknown) => {
      if (typeof choice !== "string" || !choice.trim() || choice.length > 240) {
        throw new Error("Invalid choice.");
      }
      return choice;
    });
    return { question: item.question, choices };
  });
}
