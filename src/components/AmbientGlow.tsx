import { useEffect, useRef } from "react";

// Ambient radial gradient that follows the pointer
// Respects prefers-reduced-motion by reducing intensity
const AmbientGlow = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onMove = (e: MouseEvent) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty('--x', `${x}px`);
      el.style.setProperty('--y', `${y}px`);
    };

    if (!prefersReduced) {
      window.addEventListener('mousemove', onMove);
    }
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          'radial-gradient(600px circle at var(--x,50%) var(--y,20%), hsl(var(--accent) / 0.12), transparent 40%)',
      }}
    />
  );
};

export default AmbientGlow;
