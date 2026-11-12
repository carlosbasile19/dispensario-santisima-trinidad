import type { CSSProperties } from "react";

import { Icon } from "@/components/crm/icons";

// The dictation's orb: still and breathing until the member starts, swelling
// with the voice while it listens (--level, from use-mic-level), dimmed when
// paused, spinning while Claude sorts the results. Pure CSS (globals.css,
// "Dictation"), transforms and opacity only so it stays smooth on phones.

export type OrbState = "idle" | "listening" | "paused" | "thinking";

const BARS = [0.55, 0.85, 1, 0.8, 0.5];

export function VoiceOrb({ state, size = "lg" }: { state: OrbState; size?: "lg" | "sm" }) {
  return (
    <span className={`voice-orb ${size === "sm" ? "voice-orb-sm" : ""}`} data-state={state} aria-hidden="true">
      <span className="voice-orb-halo" />
      <span className="voice-orb-ring" />
      <span className="voice-orb-core">
        <span className="voice-orb-swirl" />
      </span>
      <span className="voice-orb-icon">
        {state === "listening" ? (
          <span className="voice-bars">
            {BARS.map((k, i) => (
              <span key={i} style={{ "--k": k, "--i": i } as CSSProperties} />
            ))}
          </span>
        ) : state === "thinking" ? (
          <Icon name="sparkle" className="size-[38%]" />
        ) : (
          <Icon name="mic" className="size-[36%]" />
        )}
      </span>
    </span>
  );
}
