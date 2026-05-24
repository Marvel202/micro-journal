export type SentenceCheck = { ok: true } | { ok: false; reason: string };

export function validateSentence(raw: string): SentenceCheck {
  const text = raw.trim();
  if (text.length === 0) return { ok: false, reason: "Write something." };
  if (text.length > 240) return { ok: false, reason: "Keep it under 240 characters." };

  const terminators = text.match(/[.!?]/g) ?? [];
  if (terminators.length === 0) {
    return { ok: false, reason: "End with one . ! or ?" };
  }
  if (terminators.length > 1) {
    return { ok: false, reason: "Only one sentence — one terminator allowed." };
  }
  if (!/[.!?]\s*$/.test(text)) {
    return { ok: false, reason: "The . ! or ? must come at the end." };
  }
  if (/[\r\n]/.test(text)) {
    return { ok: false, reason: "One line, please." };
  }
  return { ok: true };
}
