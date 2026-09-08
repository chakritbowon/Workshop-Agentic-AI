const GEMINI_TYPES = new Set(["string", "number", "integer", "boolean", "object", "array"]);

export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...schema };
  if (typeof schema.type === "string" && GEMINI_TYPES.has(schema.type.toLowerCase())) {
    output.type = schema.type.toUpperCase();
  }
  if (schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)) {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      properties[key] = value && typeof value === "object" && !Array.isArray(value)
        ? toGeminiSchema(value as Record<string, unknown>)
        : value;
    }
    output.properties = properties;
  }
  if (schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)) {
    output.items = toGeminiSchema(schema.items as Record<string, unknown>);
  }
  return output;
}