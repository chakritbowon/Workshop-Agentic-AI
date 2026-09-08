import { ChatMessage, ChatTurnResult, McpTool, ToolCaller, ToolTraceEntry } from "../types";

export async function runOpenAiCompatConversation(
  baseUrl: string | undefined, apiKey: string | undefined, model: string, systemPrompt: string,
  history: ChatMessage[], tools: McpTool[], callTool: ToolCaller,
): Promise<ChatTurnResult> {
  if (!baseUrl?.trim()) return { reply: "ยังไม่ได้ตั้งค่า OPENAI_COMPAT_BASE_URL กรุณาตั้งค่า gateway URL ใน wrangler.toml", toolTrace: [] };
  if (!apiKey?.trim()) return { reply: "ยังไม่ได้ตั้งค่า API key ของ provider นี้ กรุณาตั้งค่า OPENAI_API_KEY หรือ OPENAI_COMPAT_API_KEY", toolTrace: [] };
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const messages: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt }, ...history.map((message) => ({ role: message.role, content: message.content }))];
  const toolTrace: ToolTraceEntry[] = [];
  for (let round = 0; round < 4; round += 1) {
    const body: Record<string, unknown> = { model, messages };
    if (tools.length) { body.tools = tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } })); body.tool_choice = "auto"; }
    let response: Response;
    try { response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) }); }
    catch { return { reply: "ไม่สามารถเชื่อมต่อ AI gateway ได้ กรุณาตรวจสอบ URL และลองใหม่อีกครั้ง", toolTrace }; }
    if (!response.ok) return { reply: `AI gateway ตอบกลับผิดพลาด (${response.status}) กรุณาตรวจสอบการตั้งค่า`, toolTrace };
    const data = await response.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }> };
    const message = data.choices?.[0]?.message;
    if (!message) return { reply: "AI gateway ไม่ได้ส่งข้อความตอบกลับ", toolTrace };
    if (!message.tool_calls?.length) return { reply: message.content?.trim() || "โมเดลไม่ได้ส่งข้อความตอบกลับ", toolTrace };
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      let args: unknown = {};
      try { args = JSON.parse(call.function.arguments); } catch { args = {}; }
      const trace: ToolTraceEntry = { name: call.function.name, arguments: args };
      try { trace.result = await callTool(call.function.name, args); } catch (error) { trace.error = error instanceof Error ? error.message : "เรียกใช้ tool ไม่สำเร็จ"; }
      toolTrace.push(trace);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(trace.error ? { error: trace.error } : trace.result) });
    }
  }
  return { reply: "โมเดลเรียกใช้เครื่องมือเกินจำนวนรอบที่อนุญาต", toolTrace };
}