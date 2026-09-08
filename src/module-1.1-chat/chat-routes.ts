import { Env } from "../env";
import { errorJson, json } from "../lib/http";
import { runGeminiConversation } from "./providers/gemini";
import { runOpenAiCompatConversation } from "./providers/openai-compat";
import { ChatMessage, ChatProvider, ChatTurnResult, McpTool } from "./types";

interface ChatRequest { message: string; history?: ChatMessage[]; provider?: string; model?: string }

export function buildSystemPrompt(): string {
  return "คุณคือผู้ช่วย AI ภาษาไทย ตอบให้ชัดเจน สุภาพ และตรงประเด็น หากไม่แน่ใจให้บอกตามจริง";
}

export function resolveProvider(env: Env, provider?: string): ChatProvider {
  const selected = provider || env.DEFAULT_CHAT_PROVIDER || "gemini";
  return selected === "openai" || selected === "openai-compat" ? selected : "gemini";
}

export function defaultModelFor(env: Env, provider: ChatProvider): string {
  if (provider === "gemini") return env.GEMINI_MODEL || "gemini-flash-latest";
  if (provider === "openai") return env.OPENAI_MODEL || "gpt-4o-mini";
  return env.OPENAI_COMPAT_MODEL || "gpt-4o-mini";
}

function resolveApiKey(env: Env, provider: ChatProvider): string | undefined {
  return provider === "gemini" ? env.GEMINI_API_KEY : provider === "openai" ? env.OPENAI_API_KEY : env.OPENAI_COMPAT_API_KEY;
}

function resolveBaseUrl(env: Env, provider: ChatProvider): string | undefined {
  return provider === "openai" ? "https://api.openai.com/v1" : env.OPENAI_COMPAT_BASE_URL;
}

function resolveTools(): McpTool[] { return []; }

export async function runChatTurn(env: Env, input: ChatRequest): Promise<ChatTurnResult & { provider: ChatProvider; model: string }> {
  const provider = resolveProvider(env, input.provider);
  const model = input.model?.trim() || defaultModelFor(env, provider);
  const history: ChatMessage[] = [...(input.history || []), { role: "user", content: input.message }];
  const tools = resolveTools();
  const callTool = async (): Promise<unknown> => { throw new Error("ยังไม่มี MCP tools ใน module นี้"); };
  const result = provider === "gemini"
    ? await runGeminiConversation(resolveApiKey(env, provider), model, buildSystemPrompt(), history, tools, callTool)
    : await runOpenAiCompatConversation(resolveBaseUrl(env, provider), resolveApiKey(env, provider), model, buildSystemPrompt(), history, tools, callTool);
  return { ...result, provider, model };
}

export async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return errorJson("ต้องใช้ POST สำหรับ /api/chat", 405);
  let input: ChatRequest;
  try { input = await request.json() as ChatRequest; } catch { return errorJson("รูปแบบ JSON ไม่ถูกต้อง", 400); }
  if (typeof input.message !== "string" || !input.message.trim()) return errorJson("กรุณาระบุ message", 400);
  const history = Array.isArray(input.history) ? input.history.filter((item): item is ChatMessage => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string") : [];
  const result = await runChatTurn(env, { ...input, history, message: input.message.trim() });
  return json(result);
}