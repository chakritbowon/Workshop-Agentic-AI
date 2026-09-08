import { ChatMessage, ChatTurnResult, McpTool, ToolCaller, ToolTraceEntry } from "../types";
import { toGeminiSchema } from "../tool-schema";

interface GeminiPart { text?: string; functionCall?: { name: string; args?: unknown }; functionResponse?: { name: string; response: unknown } }

export async function runGeminiConversation(
  apiKey: string | undefined,
  model: string,
  systemPrompt: string,
  history: ChatMessage[],
  tools: McpTool[],
  callTool: ToolCaller,
): Promise<ChatTurnResult> {
  if (!apiKey?.trim()) return { reply: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาตั้งค่า secret นี้ก่อนใช้งาน Gemini", toolTrace: [] };
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }],
  }));
  const toolTrace: ToolTraceEntry[] = [];
  for (let round = 0; round < 4; round += 1) {
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: systemPrompt }] }, contents,
    };
    if (tools.length) body.tools = [{ functionDeclarations: tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: toGeminiSchema(tool.inputSchema) })) }];
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
    } catch { return { reply: "ไม่สามารถเชื่อมต่อ Gemini ได้ กรุณาลองใหม่อีกครั้ง", toolTrace }; }
    if (!response.ok) return { reply: `Gemini ตอบกลับผิดพลาด (${response.status}) กรุณาตรวจสอบ API key และชื่อโมเดล`, toolTrace };
    const data = await response.json() as { candidates?: Array<{ content?: { role?: "model"; parts?: GeminiPart[] } }> };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((part) => part.functionCall?.name);
    if (!calls.length) return { reply: parts.map((part) => part.text ?? "").join("").trim() || "โมเดลไม่ได้ส่งข้อความตอบกลับ", toolTrace };
    contents.push({ role: "model", parts });
    for (const part of calls) {
      const call = part.functionCall!;
      const trace: ToolTraceEntry = { name: call.name, arguments: call.args };
      try { trace.result = await callTool(call.name, call.args ?? {}); } catch (error) { trace.error = error instanceof Error ? error.message : "เรียกใช้ tool ไม่สำเร็จ"; }
      toolTrace.push(trace);
      contents.push({ role: "user", parts: [{ functionResponse: { name: call.name, response: trace.error ? { error: trace.error } : trace.result } }] });
    }
  }
  return { reply: "โมเดลเรียกใช้เครื่องมือเกินจำนวนรอบที่อนุญาต", toolTrace };
}