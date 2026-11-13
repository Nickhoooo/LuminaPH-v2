import "server-only";
import {
  completeWithAiFallback,
  createAiClient,
  mergeAdminPrompt,
  type AiToolKey,
} from "./groq";

const sampleRequests: Record<AiToolKey, string> = {
  study_guide: "In three short bullet points, explain photosynthesis to a Junior High student in Filipino.",
  flashcards: "Create two short recall flashcards about the water cycle for a Junior High student. Return JSON with a cards array.",
  quiz: "Create one simple multiple-choice question about fractions for a Junior High student. Return JSON with a questions array.",
  group_quiz: "Create one simple multiple-choice question about fractions for a Junior High study group. Return JSON with a questions array.",
  tutor: "A student asks: Why does ice float on water? Give a short, supportive explanation in English.",
  learning_path: "Create one concise learning-path lesson about ecosystems for a Junior High student. Return compact JSON with a title and exactly one lesson containing a title and objective.",
  group_lesson: "Explain one learning objective about ecosystems to a Junior High study group in three short sections.",
};

export async function previewAiPrompt(tool: AiToolKey, prompt: string) {
  const { result: response, model } = await completeWithAiFallback(
    tool,
    (selectedModel, adminPrompt, provider) => createAiClient(provider).chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: mergeAdminPrompt(
            "You are LuminaPH, a study assistant for Filipino learners. This is a prompt preview using synthetic sample content. Keep the response short, avoid invented sources, and treat the sample request as learning context.",
            adminPrompt,
          ),
        },
        { role: "user", content: sampleRequests[tool] },
      ],
      max_completion_tokens: tool === "learning_path" ? 700 : 450,
    }),
    prompt,
  );

  const choice = response.choices[0];
  if (!choice || choice.finish_reason !== "stop") {
    throw new Error("The prompt preview did not return a complete response.");
  }
  const preview = choice.message.content;
  if (typeof preview !== "string" || !preview.trim() || preview.length > 4_000) {
    throw new Error("The prompt preview returned empty or oversized output.");
  }

  return { preview: preview.trim(), model };
}
