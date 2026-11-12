import "server-only";

// Dictation runs on Claude with the clinic's key (ANTHROPIC_API_KEY, server
// only). LAB_DICTATION_MODEL and LAB_DICTATION_EFFORT change the model and
// how long it thinks without a deploy of new code.

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

export const dictationReady = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

export function dictationConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.LAB_DICTATION_MODEL?.trim() || "claude-opus-5-5";
  const effort = (EFFORTS as readonly string[]).includes(process.env.LAB_DICTATION_EFFORT ?? "") ? (process.env.LAB_DICTATION_EFFORT as Effort) : "medium";
  return { apiKey, model, effort };
}
