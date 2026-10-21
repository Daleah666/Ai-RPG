/**
 * Rough token estimate (about 4 characters per token for English).
 * Real counts depend on the model's tokenizer; this is for budgeting, not billing.
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}
