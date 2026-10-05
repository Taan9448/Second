import { useEffect, useRef } from 'react';
import type { Cue, Technique } from './choreography';
let dragonAtlas: HTMLImageElement | undefined;
function loadDragon() {
  dragonAtlas ??= new Image();
  if (!dragonAtlas.src)
    dragonAtlas.src = new URL('art/ink-dragon-animation.png', document.baseURI).href;
  return dragonAtlas;
}
const colors: Record<Technique, string> = {
  ink: '#eee9de',
  double: '#fff8ec',
  break: '#f05452',
  dragon: '#e8e4dc',
  guard: '#9cbec7',
  focus: '#d9c3a0',
  heal: '#9fe0be',
  fire: '#ff8c3c',
  ice: '#a3ddf0',
  lightning: '#c4abff',
  holy: '#ecd38d',
  enemy: '#e86453',
};
export function TechniqueIcon({ technique }: { technique: Technique }) {
  return (
    <svg viewBox="0 0 80 50" aria-hidden="true" className={`technique-icon icon-${technique}`}>
      {technique === 'guard' ? (
        <path d="M40 7 57 13V27Q54 38 40 44Q26 38 23 27V13Z M40 16V34M32 25H48" />
      ) : technique === 'heal' ? (
        <path d="M36 11H44V21H54V29H44V39H36V29H26V21H36Z" />
      ) : technique === 'focus' ? (
        <>
          <circle cx="40" cy="25" r="14" />
          <path d="M40 5V14M40 36V45M20 25H29M51 25H60" />
        </>
      ) : technique === 'lightning' ? (
        <path d="M44 5 29 28H41L35 46 55 21H43Z" />
      ) : technique === 'fire' ? (
        <path d="M40 5Q44 17 50 21Q61 37 44 43Q27 46 24 32Q24 23 34 17Q31 31 39 30Q46 26 40 5Z" />
      ) : technique === 'ice' ? (
        <path d="M40 5V45M23 15 57 35M23 35 57 15M34 10 40 15 46 10M34 40 40 35 46 40" />
      ) : technique === 'dragon' ? (
        <path d="M16 36Q27 13 43 30Q52 42 65 18L58 12 49 15 55 22M63 12 65 5M57 13 54 8M20 39 31 40" />
      ) : technique === 'double' ? (
        <path d="M13 35Q30 5 62 12M21 44Q39 17 70 24" />
      ) : technique === 'break' ? (
        <path d="M17 40 63 10M40 13 34 22 44 28 36 38M20 17 26 20M54 37 61 40" />
      ) : technique === 'holy' ? (
        <path d="M40 5V42M32 15H48M35 35H45M20 10 23 17 30 20 23 23 20 30 17 23 10 20 17 17Z" />
      ) : (
        <path d="M13 39Q29 8 67 10Q37 21 19 40M22 34 16 41M27 29 24 34" />
      )}
    </svg>
  );
}
export function BattleEffects({ cue, motion }: { cue: Cue | null; motion: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    loadDragon();
  }, []);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !cue || !motion) return;
    const ctx = canvas.getContext('2d');
    const field = canvas.parentElement;
    if (!ctx || !field) return;
    let frame = 0;
    const started = performance.now();
    const render = (now: number) => {
      const rect = field.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const point = (id: string) => {
        const element = [...field.querySelectorAll<HTMLElement>('[data-unit]')].find(
          (u) => u.dataset.unit === id,
        );
        const box =
          element?.querySelector('.fighter-body')?.getBoundingClientRect() ??
          element?.getBoundingClientRect();
        return box
          ? { x: box.left - rect.left + box.width * 0.5, y: box.top - rect.top + box.height * 0.5 }
          : { x: rect.width / 2, y: rect.height / 2 };
      };
      const a = point(cue.sourceId),
        b = point(cue.targetId);
      const p = Math.min(1, (now - started) / cue.duration);
      const color = colors[cue.technique];
      const line = (x: number, y: number, ex: number, ey: number, width: number, ink: string) => {
        ctx.strokeStyle = ink;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      };
      const ring = (x: number, y: number, r: number, ink: string, width = 2) => {
        ctx.strokeStyle = ink;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      };
      if (cue.beat === 'windup') {
        ctx.globalAlpha = 0.65 * p;
        ring(a.x, a.y + 36, 25 + p * 30, color);
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4 + p;
          ctx.fillStyle = color;
          ctx.fillRect(
            a.x + Math.cos(angle) * (60 - p * 30),
            a.y + Math.sin(angle) * (60 - p * 30),
            3,
            3,
          );
        }
      } else if (cue.beat === 'release') {
        const t = 1 - Math.pow(1 - p, 2);
        const x = a.x + (b.x - a.x) * t,
          y = a.y + (b.y - a.y) * t;
        if (['guard', 'focus', 'heal'].includes(cue.technique)) {
          ctx.globalAlpha = 0.8;
          ring(a.x, a.y, 35 + p * 45, color, 3);
          for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6;
            line(
              a.x + Math.cos(angle) * 24,
              a.y + Math.sin(angle) * 24,
              a.x + Math.cos(angle) * (30 + p * 50),
              a.y + Math.sin(angle) * (30 + p * 50),
              2,
              color,
            );
          }
        } else if (
          cue.technique === 'dragon' &&
          loadDragon().complete &&
          loadDragon().naturalWidth
        ) {
          const atlas = loadDragon();
          const cellW = atlas.naturalWidth / 2,
            cellH = atlas.naturalHeight / 2;
          const index = Math.min(3, Math.floor(p * 4));
          const size = Math.min(rect.width * 0.36, 490);
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = Math.min(1, p * 5);
          ctx.drawImage(
            atlas,
            (index % 2) * cellW,
            Math.floor(index / 2) * cellH,
            cellW,
            cellH,
            x - size * 0.86,
            y - size * 0.42,
            size,
            size * 0.85,
          );
        } else if (cue.technique === 'lightning') {
          let last = a;
          for (let i = 1; i <= 8; i++) {
            const next = {
              x: a.x + ((b.x - a.x) * i) / 8,
              y: a.y + ((b.y - a.y) * i) / 8 + (i < 8 ? Math.sin(i * 8 + p * 25) * 24 : 0),
            };
            line(last.x, last.y, next.x, next.y, 4, color);
            last = next;
          }
        } else {
          // Travelling brush stroke has a dark silhouette and a pale cutting edge.
          const dir = b.x >= a.x ? 1 : -1;
          for (let i = 8; i >= 0; i--) {
            const trail = i / 8;
            const tx = x - dir * i * 13;
            ctx.globalAlpha = (1 - trail) * 0.9;
            if (cue.technique === 'dragon') {
              const dy = Math.sin(trail * 7 + p * 9) * 28;
              line(tx, y + dy - 24, tx + dir * 22, y + dy + 20, 24 * (1 - trail) + 3, '#151621');
              line(tx, y + dy - 25, tx + dir * 22, y + dy + 20, 3, color);
              if (i === 0) {
                ctx.fillStyle = '#ff4949';
                ctx.fillRect(tx + dir * 10, y + dy - 7, 7, 4);
              }
            } else {
              line(
                tx - 16,
                y + 70 * (1 - trail),
                tx + 22,
                y - 70 * (1 - trail),
                cue.technique === 'fire' ? 18 : 10,
                cue.technique === 'ink' || cue.technique === 'double' ? '#141522' : color,
              );
              line(tx - 17, y + 68 * (1 - trail), tx + 23, y - 68 * (1 - trail), 3, color);
            }
          }
        }
      } else if (cue.beat === 'impact') {
        const isSupport =
          cue.event?.kind === 'block' ||
          cue.event?.kind === 'heal' ||
          ['guard', 'focus', 'heal'].includes(cue.technique);
        const x = b.x,
          y = b.y;
        ctx.globalAlpha = 1 - p;
        if (isSupport) {
          ring(x, y, 40 + p * 25, color, 3);
          if (cue.technique === 'guard') {
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x, y - 56);
            ctx.lineTo(x + 42, y - 32);
            ctx.lineTo(x + 32, y + 24);
            ctx.lineTo(x, y + 54);
            ctx.lineTo(x - 32, y + 24);
            ctx.lineTo(x - 42, y - 32);
            ctx.closePath();
            ctx.stroke();
          }
        } else {
          const flip = cue.strike % 2 ? -1 : 1;
          line(x - 60, y + flip * 60, x + 60, y - flip * 60, 22 * (1 - p), '#16131c');
          line(x - 64, y + flip * 64, x + 64, y - flip * 64, 7 * (1 - p) + 1, color);
          ring(x, y, 10 + p * 75, color, 2);
        }
        for (let i = 0; i < 18; i++) {
          const angle = i * 2.39996 + cue.strike;
          const radius = 10 + p * (35 + (i % 5) * 14);
          const x1 = x + Math.cos(angle) * radius,
            y1 = y + Math.sin(angle) * radius;
          ctx.fillStyle = i % 3 ? color : '#df6555';
          ctx.fillRect(Math.round(x1 / 3) * 3, Math.round(y1 / 3) * 3, (i % 4) + 2, (i % 3) + 2);
        }
      }
      if (p < 1) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [cue, motion]);
  return (
    <canvas
      ref={ref}
      className="battle-effects"
      aria-hidden="true"
      data-beat={cue?.beat}
      data-technique={cue?.technique}
    />
  );
}
