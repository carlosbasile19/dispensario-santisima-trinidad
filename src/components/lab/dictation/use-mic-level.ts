"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

// How loud the member is speaking, for the orb: written every frame to the CSS
// variable --level (0 to 1) of the element, so the animation never renders
// React again. On computers it reads the microphone. Phones and tablets keep
// the microphone for speech recognition alone (Android cannot share it), so
// there the orb swells each time words arrive (`bump`).

const sharesMicrophone = () =>
  !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

export function useMicLevel(target: RefObject<HTMLElement | null>, active: boolean) {
  const pulse = useRef(0);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    if (!active) {
      element.style.setProperty("--level", "0");
      return;
    }
    let stopped = false;
    let frame = 0;
    let level = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let samples: Uint8Array<ArrayBuffer> | null = null;

    if (sharesMicrophone() && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .then((media) => {
          if (stopped) {
            media.getTracks().forEach((track) => track.stop());
            return;
          }
          stream = media;
          context = new AudioContext();
          analyser = context.createAnalyser();
          analyser.fftSize = 512;
          samples = new Uint8Array(analyser.fftSize);
          context.createMediaStreamSource(media).connect(analyser);
        })
        .catch(() => undefined); // Without it the orb still swells with the words.
    }

    const tick = () => {
      let goal: number;
      if (analyser && samples) {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        goal = Math.min(1, Math.sqrt(sum / samples.length) * 5);
      } else {
        pulse.current *= 0.93;
        goal = pulse.current;
      }
      // Quick to rise, slow to settle, like a VU meter.
      level += (goal - level) * (goal > level ? 0.5 : 0.1);
      element.style.setProperty("--level", level.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      element.style.setProperty("--level", "0");
    };
  }, [active, target]);

  return useCallback(() => {
    pulse.current = Math.min(1, pulse.current + 0.6);
  }, []);
}
