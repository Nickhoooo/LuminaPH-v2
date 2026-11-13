import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import PromptVersionManager from "./PromptVersionManager";
import {
  activateAiModel,
  addAiModel,
  deleteAiModel,
  setAiToolRoute,
  setAiModelEnabled,
} from "./actions";

type RegisteredModel = {
  id: string;
  provider: "groq" | "google";
  modelId: string;
  displayName: string;
  enabled: boolean;
  createdAt: string;
};

type ToolRoute = { toolKey: string; primaryModelId: string; fallbackModelId: string | null };
type RegistryData = { activeModelId: string; models: RegisteredModel[]; routes: ToolRoute[] };
type PromptData = {
  current: { id: string; version: number; prompt: string; publishedAt: string } | null;
  draft: { id: string; version: number; prompt: string; tested: boolean; testedAt: string | null; testedModel: string | null; createdAt: string } | null;
  history: { id: string; version: number; status: "draft" | "published" | "archived"; createdAt: string; publishedAt: string | null; testedModel: string | null }[];
};
type PageProps = { searchParams: Promise<{ status?: string | string[] }> };

function isRegistryData(value: unknown): value is RegistryData {
  if (typeof value !== "object" || value === null || !("models" in value) || !Array.isArray(value.models)) return false;
  if (!("activeModelId" in value) || typeof value.activeModelId !== "string") return false;
  if (!("routes" in value) || !Array.isArray(value.routes)) return false;
  const validModels = value.models.every((model: unknown) => {
    if (typeof model !== "object" || model === null) return false;
    return "id" in model && typeof model.id === "string" &&
      "provider" in model && (model.provider === "groq" || model.provider === "google") &&
      "modelId" in model && typeof model.modelId === "string" &&
      "displayName" in model && typeof model.displayName === "string" &&
      "enabled" in model && typeof model.enabled === "boolean" &&
      "createdAt" in model && typeof model.createdAt === "string";
  });
  const validRoutes = value.routes.every((route: unknown) => {
    if (typeof route !== "object" || route === null) return false;
    return "toolKey" in route && typeof route.toolKey === "string" &&
      "primaryModelId" in route && typeof route.primaryModelId === "string" &&
      "fallbackModelId" in route && (route.fallbackModelId === null || typeof route.fallbackModelId === "string");
  });
  return validModels && validRoutes;
}

function isPromptData(value: unknown): value is PromptData {
  if (typeof value !== "object" || value === null || !("current" in value) || !("draft" in value) || !("history" in value) || !Array.isArray(value.history)) return false;
  if (value.current !== null && (typeof value.current !== "object" || value.current === null || !("id" in value.current) || typeof value.current.id !== "string" || !("version" in value.current) || typeof value.current.version !== "number" || !("prompt" in value.current) || typeof value.current.prompt !== "string" || !("publishedAt" in value.current) || typeof value.current.publishedAt !== "string")) return false;
  if (value.draft !== null && (typeof value.draft !== "object" || value.draft === null || !("id" in value.draft) || typeof value.draft.id !== "string" || !("version" in value.draft) || typeof value.draft.version !== "number" || !("prompt" in value.draft) || typeof value.draft.prompt !== "string" || !("tested" in value.draft) || typeof value.draft.tested !== "boolean" || !("testedAt" in value.draft) || (value.draft.testedAt !== null && typeof value.draft.testedAt !== "string") || !("testedModel" in value.draft) || (value.draft.testedModel !== null && typeof value.draft.testedModel !== "string") || !("createdAt" in value.draft) || typeof value.draft.createdAt !== "string")) return false;
  return value.history.every((item: unknown) => typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "version" in item && typeof item.version === "number" &&
    "status" in item && (item.status === "draft" || item.status === "published" || item.status === "archived") &&
    "createdAt" in item && typeof item.createdAt === "string" &&
    "publishedAt" in item && (item.publishedAt === null || typeof item.publishedAt === "string") &&
    "testedModel" in item && (item.testedModel === null || typeof item.testedModel === "string"));
}

const buttonStyle = "rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800";
const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
const toolLabels: Record<string, string> = {
  study_guide: "Study guides",
  flashcards: "Flashcards",
  quiz: "Quizzes",
  group_quiz: "Study Group quizzes",
  tutor: "AI Tutor",
  learning_path: "Learning paths",
  group_lesson: "Study Group lessons",
};

export default async function AdminAiControlPage({ searchParams }: PageProps) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const [registryResult, permissionResult] = await Promise.all([
    supabase.rpc("get_admin_ai_model_registry"),
    supabase.rpc("is_super_administrator"),
  ]);
  const status = typeof query.status === "string" ? query.status : "";
  const successNotice = status === "saved";
  const errorNotice = status === "error";

  if (registryResult.error || !isRegistryData(registryResult.data)) {
    return (
      <section className="max-w-3xl space-y-5">
        <header>
          <h1 className="text-3xl font-semibold">AI Control</h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">Manage the Groq and Google Gemini models available to LuminaPH.</p>
        </header>
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          The AI model registry or tool routes are not available. Check that `202611010001_add_ai_model_registry.sql` and `202611010002_add_ai_tool_routing.sql` have been applied and that your account has Admin access.
        </p>
        <Link href="/admin" className={buttonStyle}>Back to overview</Link>
      </section>
    );
  }

  const registry = registryResult.data;
  const canManage = permissionResult.data === true;
  const toolEntries = Object.entries(toolLabels);
  const promptResults = await Promise.all(toolEntries.map(([toolKey]) =>
    supabase.rpc("get_admin_ai_prompt", { p_tool_key: toolKey }),
  ));
  const promptsReady = promptResults.every((result) => !result.error && isPromptData(result.data));

  return (
    <section className="max-w-6xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800 dark:text-emerald-300">AI operations</p>
        <h1 className="mt-2 text-3xl font-semibold">AI Control</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-300">
          Manage Groq and Google Gemini models, tool routing, and optional prompt guidance. Provider credentials stay in server environment settings.
        </p>
      </header>

      {successNotice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">AI model settings saved.</p>}
      {errorNotice && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">Could not save that change. Check the model ID and permissions, then try again.</p>}

      <nav aria-label="AI Control sections" className="flex flex-wrap gap-2 border-b border-stone-200 pb-4 dark:border-stone-700">
        {[
          ["#models", `Models (${registry.models.length})`],
          ["#routing", "Tool routing"],
          ["#prompts", "Prompt versions"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-emerald-700 hover:text-emerald-800 dark:border-stone-700 dark:text-stone-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300">
            {label}
          </a>
        ))}
      </nav>

      <section id="models" className="scroll-mt-6 space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Models</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">Add, activate, or disable registered provider models.</p>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">{registry.models.filter((model) => model.enabled).length} enabled · {registry.models.length} total</p>
        </header>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900 md:p-6">
          <h3 className="font-semibold">Register a model</h3>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">Registering a model does not activate it. The provider's server-side API key must also be configured.</p>
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Google Gemini Free Tier may use submitted prompts and responses to improve Google products. Use synthetic content for free-tier tests; do not route learner submissions through it unless LuminaPH's data policy and consent cover that use.
          </p>
          {canManage ? (
            <form action={addAiModel} className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <label className="text-sm font-medium">Provider
                <select name="provider" defaultValue="google" required className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-950">
                  <option value="groq">Groq</option>
                  <option value="google">Google Gemini</option>
                </select>
              </label>
              <label className="text-sm font-medium">Model ID
                <input name="modelId" required maxLength={160} pattern="[A-Za-z0-9._/-]+" placeholder="gemini-3.5-flash-lite" className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 font-mono text-sm dark:border-stone-700 dark:bg-stone-950" />
              </label>
              <label className="text-sm font-medium">Display name
                <input name="displayName" required maxLength={100} placeholder="Model name for admins" className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-950" />
              </label>
              <button className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Register model</button>
            </form>
          ) : <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">Only a Super Admin can change AI model settings.</p>}
        </div>

        <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">To disable or remove a model, move every tool route away from it first. Setting a global default applies it to all tools and clears their fallback choices.</p>
        {registry.models.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {registry.models.map((model) => {
              const isActive = model.id === registry.activeModelId;
              return (
                <article key={model.id} className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{model.displayName}</h3>
                        {isActive && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">Global default</span>}
                        {!model.enabled && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-200">Disabled</span>}
                      </div>
                      <p className="mt-2 break-all font-mono text-xs text-stone-600 dark:text-stone-300">{model.provider === "google" ? "Google Gemini" : "Groq"} · {model.modelId}</p>
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Added {dateFormatter.format(new Date(model.createdAt))}</p>
                    </div>
                    {canManage && <div className="flex flex-wrap gap-2">
                      {!isActive && model.enabled && <form action={activateAiModel}><input type="hidden" name="modelId" value={model.id} /><button className="rounded-xl bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900">Set for all tools</button></form>}
                      <form action={setAiModelEnabled}>
                        <input type="hidden" name="modelId" value={model.id} />
                        <input type="hidden" name="enabled" value={String(!model.enabled)} />
                        <button disabled={isActive} className={`${buttonStyle} px-3 py-2 text-xs`}>{model.enabled ? "Disable" : "Enable"}</button>
                      </form>
                      {!model.enabled && <form action={deleteAiModel}>
                        <input type="hidden" name="modelId" value={model.id} />
                        <button className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950">Remove</button>
                      </form>}
                    </div>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">No models are registered.</p>}
      </section>

      <section id="routing" className="scroll-mt-6 space-y-4">
        <header>
          <h2 className="text-xl font-semibold">Tool routing</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-stone-600 dark:text-stone-300">Choose a primary model and optional fallback for each tool. A retryable provider failure can trigger at most one fallback attempt; authentication and invalid-request errors do not.</p>
        </header>
        <div className="grid gap-3 xl:grid-cols-2">
        {registry.routes.map((route) => (
          <article key={route.toolKey} className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
            <h3 className="font-semibold">{toolLabels[route.toolKey] ?? route.toolKey}</h3>
            {canManage ? (
              <form action={setAiToolRoute} className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <input type="hidden" name="toolKey" value={route.toolKey} />
                <label className="text-sm font-medium">Primary model
                  <select name="primaryModelId" defaultValue={route.primaryModelId} required className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-950">
                    {registry.models.filter((model) => model.enabled).map((model) => <option key={model.id} value={model.id}>{model.displayName} ({model.modelId})</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">Fallback model
                  <select name="fallbackModelId" defaultValue={route.fallbackModelId ?? ""} className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-950">
                    <option value="">No fallback</option>
                    {registry.models.filter((model) => model.enabled).map((model) => <option key={model.id} value={model.id}>{model.displayName} ({model.modelId})</option>)}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-stone-500">Choose a different model from the primary.</span>
                </label>
                <button className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Save route</button>
              </form>
            ) : (
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                Primary: {registry.models.find((model) => model.id === route.primaryModelId)?.displayName ?? "Unavailable model"}
                {" · Fallback: "}{registry.models.find((model) => model.id === route.fallbackModelId)?.displayName ?? "Off"}
              </p>
            )}
          </article>
        ))}
        </div>
      </section>

      <section id="prompts" className="scroll-mt-6 space-y-4">
        <header>
          <h2 className="text-xl font-semibold">Prompt versions</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-stone-600 dark:text-stone-300">
            Edit optional teaching guidance, test with synthetic content, and publish or restore a version. Fixed LuminaPH system instructions remain in code and take priority.
          </p>
        </header>
        {!promptsReady ? (
          <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Prompt versioning is not available yet. Check that `202611110001_add_ai_prompt_versioning.sql` has been applied.
          </p>
        ) : <div className="space-y-3">{toolEntries.map(([toolKey, toolLabel], index) => (
          <PromptVersionManager
            key={`${toolKey}:${promptResults[index].data.current?.id ?? "none"}`}
            toolKey={toolKey}
            toolLabel={toolLabel}
            promptState={promptResults[index].data as PromptData}
            canManage={canManage}
          />
        ))}</div>}
      </section>
    </section>
  );
}
