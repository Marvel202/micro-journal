export const PROMPTS = [
  "What surprised you today?",
  "Describe a sound you heard today.",
  "What did you almost say but didn't?",
  "Capture a small kindness you witnessed.",
  "What color defined today?",
  "Who crossed your mind unexpectedly?",
  "What did your hands do today?",
  "Name one thing you'd rather forget.",
  "What did today smell like?",
  "Where did your attention drift?",
  "What did you postpone today?",
  "Describe today's weather inside your head.",
  "What made you pause?",
  "What did you almost throw away?",
  "Who made you laugh, even briefly?",
  "What felt heavier than it should have?",
  "What did you carry from yesterday into today?",
  "What's the first thing you'd tell a stranger about today?",
  "Capture a small victory.",
  "What was the texture of today?",
  "What did you avoid?",
  "What word kept appearing today?",
  "Describe the quietest moment.",
  "What did you almost finish?",
  "What looked different today than yesterday?",
  "What did you eat that you'll remember?",
  "What did the light do today?",
  "Who needed you?",
  "What did you let go of?",
  "What were you wrong about?",
  "What were you right about?",
];

export function promptForDate(date: Date): string {
  const epoch = new Date(2024, 0, 1).getTime();
  const day = Math.floor((date.getTime() - epoch) / 86_400_000);
  const idx = ((day % PROMPTS.length) + PROMPTS.length) % PROMPTS.length;
  return PROMPTS[idx];
}

export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
