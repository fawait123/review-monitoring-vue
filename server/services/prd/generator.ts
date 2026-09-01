import type { TaskDraft } from "~~/shared/types";
import type { PrdStackInput } from "./prompt";
import { lastAssistantText, cleanText, isTransientError, delay, extractJson } from "../review/utils";
import {
  PRD_SYSTEM_PROMPT,
  buildPrdUserPrompt,
  TASK_BREAKDOWN_SYSTEM_PROMPT,
  buildTaskBreakdownUserPrompt,
} from "./prompt";

interface ResolvedModel {
  runtime: any;
  model: any;
  thinkingLevel: string | undefined;
}

async function resolveModel(): Promise<ResolvedModel> {
  const pi = await import("@earendil-works/pi-coding-agent");
  const { configPaths } = await import("../model-config-paths");
  const { getModelConfig } = await import("../db/model-config");

  const { modelsPath, authPath } = configPaths();
  const runtime = await pi.ModelRuntime.create({ modelsPath, authPath });

  const cfg = await getModelConfig();
  let model: unknown = undefined;
  let thinkingLevel: string | undefined = "medium";
  if (cfg) {
    const m = runtime.getModel(cfg.providerId, cfg.modelId);
    if (m) {
      model = m;
      thinkingLevel = cfg.thinkingLevel;
    }
  }
  if (!model) {
    const available = await runtime.getAvailable();
    if (available.length > 0) model = available[0];
  }
  return { runtime, model, thinkingLevel };
}

async function createSession(pi: any) {
  const { runtime, model, thinkingLevel } = await resolveModel();
  const { session } = await pi.createAgentSession({
    modelRuntime: runtime,
    model,
    thinkingLevel,
    sessionManager: pi.SessionManager.inMemory(),
    tools: [],
    cwd: process.cwd(),
  });
  return { session, model };
}

/** Call LLM + subscribe streaming delta → cb.onDelta. Return final text. */
async function streamPrompt(pi: any, system: string, user: string, onDelta: (d: string) => void): Promise<{ text: string; model: string | null }> {
  const { session, model } = await createSession(pi);
  session.subscribe((event: { type: string; assistantMessageEvent?: { type?: string; delta?: string } }) => {
    if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta" && event.assistantMessageEvent.delta) {
      onDelta(event.assistantMessageEvent.delta);
    }
  });
  const prompt = `${system}\n\n${user}`;
  let lastErr: unknown = null;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await session.prompt(prompt);
        lastErr = null;
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (isTransientError(err) && attempt < 2) {
          await delay((attempt + 1) * 8000);
          continue;
        }
        throw err;
      }
    }
    if (lastErr) throw lastErr;
    return { text: lastAssistantText(session.agent.state.messages), model: session.model?.id ?? (model?.id ?? null) };
  } finally {
    session.dispose();
  }
}

export interface GeneratePrdResult {
  content: string;
  model: string | null;
  title: string;
}

/** Generate PRD + stream tiap token ke onDelta. */
export async function generatePrdStream(
  input: string,
  stack: PrdStackInput,
  onDelta: (delta: string) => void,
): Promise<GeneratePrdResult> {
  const pi = await import("@earendil-works/pi-coding-agent");
  const { text, model } = await streamPrompt(pi, PRD_SYSTEM_PROMPT, buildPrdUserPrompt(input, stack), onDelta);
  const content = cleanText(text);
  const title =
    content.split("\n").find((l) => l.trim().startsWith("# "))?.replace(/^#\s*/, "").trim() || "PRD";
  return { content, model, title };
}

export async function breakdownTasks(prdContent: string): Promise<TaskDraft[]> {
  const pi = await import("@earendil-works/pi-coding-agent");
  const { session } = await createSession(pi);
  const prompt = `${TASK_BREAKDOWN_SYSTEM_PROMPT}\n\n${buildTaskBreakdownUserPrompt(prdContent)}`;
  let lastErr: unknown = null;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await session.prompt(prompt);
        lastErr = null;
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (isTransientError(err) && attempt < 2) {
          await delay((attempt + 1) * 8000);
          continue;
        }
        throw err;
      }
    }
    if (lastErr) throw lastErr;
    const text = lastAssistantText(session.agent.state.messages);
    const parsed = extractJson(text) as { tasks?: unknown[] } | null;
    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    return tasks
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({
        title: String(t.title ?? "").trim(),
        description: String(t.description ?? "").trim(),
        acceptanceCriteria: String(t.acceptanceCriteria ?? "").trim(),
      }))
      .filter((t) => t.title.length > 0);
  } catch (err: unknown) {
    throw new Error(`Gagal memparsing tasks: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    session.dispose();
  }
}
