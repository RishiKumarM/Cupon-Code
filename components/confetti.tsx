"use client";

import { useEffect, useRef } from "react";

interface ConfettiProps {
  trigger: boolean;
}

export function Confetti({ trigger }: ConfettiProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!trigger || firedRef.current) return;

    const launch = async () => {
      const confetti = (await import("canvas-confetti")).default;
      firedRef.current = true;

      const count = 200;
      const defaults = { origin: { y: 0.7 } };

      function fire(
        particleRatio: number,
        opts: Record<string, unknown>
      ) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    };

    launch();
  }, [trigger]);

  return null;
}
