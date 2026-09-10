'use client';

import React, { useCallback, useEffect, useState } from 'react';

const TITLE = '欢迎来到喵喵的拼豆小屋';

const FUR = '#FFE4B5';
const EDGE = '#E0922F';
const EAR = '#F7A8C4';
const EYE = '#3A2416';
const HIGHLIGHT = '#FFF9F0';
const NOSE = '#F472B6';
const BLUSH = '#F9A8D4';
const PAW = '#F6C98B';

/** 11×9 拼豆小猫，坐标从左上角开始 */
const CAT: { c: number; r: number; color: string }[] = [
  // 耳朵
  { c: 1, r: 0, color: EDGE },
  { c: 2, r: 0, color: EAR },
  { c: 8, r: 0, color: EAR },
  { c: 9, r: 0, color: EDGE },
  { c: 1, r: 1, color: EDGE },
  { c: 2, r: 1, color: EAR },
  { c: 3, r: 1, color: EDGE },
  { c: 7, r: 1, color: EDGE },
  { c: 8, r: 1, color: EAR },
  { c: 9, r: 1, color: EDGE },
  // 脸
  { c: 1, r: 2, color: EDGE },
  { c: 2, r: 2, color: FUR },
  { c: 3, r: 2, color: FUR },
  { c: 4, r: 2, color: FUR },
  { c: 5, r: 2, color: FUR },
  { c: 6, r: 2, color: FUR },
  { c: 7, r: 2, color: FUR },
  { c: 8, r: 2, color: FUR },
  { c: 9, r: 2, color: EDGE },
  { c: 0, r: 3, color: EDGE },
  { c: 1, r: 3, color: FUR },
  { c: 2, r: 3, color: HIGHLIGHT },
  { c: 3, r: 3, color: EYE },
  { c: 4, r: 3, color: FUR },
  { c: 5, r: 3, color: FUR },
  { c: 6, r: 3, color: FUR },
  { c: 7, r: 3, color: EYE },
  { c: 8, r: 3, color: HIGHLIGHT },
  { c: 9, r: 3, color: FUR },
  { c: 10, r: 3, color: EDGE },
  { c: 0, r: 4, color: EDGE },
  { c: 1, r: 4, color: BLUSH },
  { c: 2, r: 4, color: FUR },
  { c: 3, r: 4, color: FUR },
  { c: 4, r: 4, color: FUR },
  { c: 5, r: 4, color: NOSE },
  { c: 6, r: 4, color: FUR },
  { c: 7, r: 4, color: FUR },
  { c: 8, r: 4, color: FUR },
  { c: 9, r: 4, color: BLUSH },
  { c: 10, r: 4, color: EDGE },
  { c: 1, r: 5, color: EDGE },
  { c: 2, r: 5, color: FUR },
  { c: 3, r: 5, color: FUR },
  { c: 4, r: 5, color: NOSE },
  { c: 5, r: 5, color: FUR },
  { c: 6, r: 5, color: NOSE },
  { c: 7, r: 5, color: FUR },
  { c: 8, r: 5, color: FUR },
  { c: 9, r: 5, color: EDGE },
  { c: 2, r: 6, color: EDGE },
  { c: 3, r: 6, color: FUR },
  { c: 4, r: 6, color: FUR },
  { c: 5, r: 6, color: FUR },
  { c: 6, r: 6, color: FUR },
  { c: 7, r: 6, color: FUR },
  { c: 8, r: 6, color: EDGE },
  // 爪子
  { c: 2, r: 8, color: PAW },
  { c: 3, r: 8, color: PAW },
  { c: 7, r: 8, color: PAW },
  { c: 8, r: 8, color: PAW },
];

const COLS = 11;
const ROWS = 9;

export default function WelcomeSplash() {
  const [phase, setPhase] = useState<'play' | 'exit' | 'gone'>('play');

  const dismiss = useCallback(() => {
    setPhase((current) => (current === 'play' ? 'exit' : current));
  }, []);

  useEffect(() => {
    if (phase !== 'play') return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const holdMs = reduced ? 900 : 3200;
    const timer = window.setTimeout(dismiss, holdMs);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [phase, dismiss]);

  useEffect(() => {
    if (phase !== 'exit') return;
    const timer = window.setTimeout(() => setPhase('gone'), 420);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      className={`welcome-splash${phase === 'exit' ? ' is-exit' : ''}`}
      role="dialog"
      aria-label={TITLE}
      onPointerDown={dismiss}
    >
      <style>{`
        .welcome-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          background:
            radial-gradient(ellipse 70% 55% at 50% 38%, #fff8ee 0%, #fde7c2 48%, #f3d2a0 100%);
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          opacity: 1;
          transform: scale(1);
          transition: opacity 380ms cubic-bezier(0.22, 1, 0.36, 1), transform 380ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .welcome-splash.is-exit {
          opacity: 0;
          transform: scale(1.03);
          pointer-events: none;
        }
        .welcome-splash__board {
          position: relative;
          width: min(280px, 78vw);
          aspect-ratio: 11 / 9;
          border-radius: 28px;
          background-color: #f7e2c4;
          background-image: radial-gradient(circle, rgba(160, 96, 32, 0.22) 1.15px, transparent 1.35px);
          background-size: 14px 14px;
          background-position: center;
          box-shadow:
            0 18px 40px rgba(120, 72, 20, 0.16),
            inset 0 0 0 1px rgba(255, 255, 255, 0.55);
        }
        .welcome-bead {
          position: absolute;
          width: 8.4%;
          aspect-ratio: 1;
          border-radius: 999px;
          left: calc(var(--c) * (100% / ${COLS}));
          top: calc(var(--r) * (100% / ${ROWS}));
          box-shadow:
            inset 0 1.5px 0 rgba(255, 255, 255, 0.7),
            inset 0 -1.5px 0 rgba(90, 48, 10, 0.12);
          opacity: 0;
          transform: translateY(-14px) scale(0.62);
          animation: welcome-bead-pop 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--i) * 16ms);
        }
        .welcome-sign {
          margin-top: 28px;
          text-align: center;
        }
        .welcome-roof {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .welcome-roof span {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          opacity: 0;
          transform: translateY(-8px) scale(0.7);
          animation: welcome-bead-pop 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .welcome-title {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 2px 1px;
          max-width: 18em;
          margin: 0 auto;
          color: #5a3418;
          font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
          font-size: clamp(26px, 6.4vw, 40px);
          font-weight: 700;
          letter-spacing: 0.06em;
          line-height: 1.35;
        }
        .welcome-char {
          display: inline-block;
          opacity: 0;
          transform: translateY(10px);
          filter: blur(4px);
          animation: welcome-char-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(520ms + var(--i) * 68ms);
        }
        .welcome-hint {
          margin: 18px 0 0;
          color: rgba(90, 52, 24, 0.55);
          font-size: 12px;
          letter-spacing: 0.18em;
          opacity: 0;
          animation: welcome-char-in 500ms ease both;
          animation-delay: 1500ms;
        }
        @keyframes welcome-bead-pop {
          0% { opacity: 0; transform: translateY(-14px) scale(0.62); }
          68% { opacity: 1; transform: translateY(2px) scale(1.08); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes welcome-char-in {
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @media (prefers-color-scheme: dark) {
          .welcome-splash {
            background:
              radial-gradient(ellipse 70% 55% at 50% 38%, #3a2c22 0%, #241910 52%, #16110d 100%);
          }
          .welcome-splash__board {
            background-color: #3a2a1e;
            background-image: radial-gradient(circle, rgba(255, 214, 160, 0.16) 1.15px, transparent 1.35px);
            box-shadow:
              0 18px 40px rgba(0, 0, 0, 0.35),
              inset 0 0 0 1px rgba(255, 220, 170, 0.12);
          }
          .welcome-title { color: #ffe7c4; }
          .welcome-hint { color: rgba(255, 226, 190, 0.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-bead,
          .welcome-roof span,
          .welcome-char,
          .welcome-hint {
            animation: none;
            opacity: 1;
            transform: none;
            filter: none;
          }
          .welcome-splash {
            transition: opacity 180ms ease;
          }
        }
      `}</style>

      <div className="flex flex-col items-center">
        <div className="welcome-splash__board" aria-hidden="true">
          {CAT.map((bead, index) => (
            <span
              key={`${bead.c}-${bead.r}-${index}`}
              className="welcome-bead"
              style={{
                backgroundColor: bead.color,
                ['--c' as string]: bead.c,
                ['--r' as string]: bead.r,
                ['--i' as string]: index,
              }}
            />
          ))}
        </div>

        <div className="welcome-sign">
          <div className="welcome-roof" aria-hidden="true">
            {['#F59E0B', '#FB7185', '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#F59E0B'].map((color, index) => (
              <span
                key={color + index}
                style={{
                  backgroundColor: color,
                  animationDelay: `${180 + index * 40}ms`,
                }}
              />
            ))}
          </div>
          <h1 className="welcome-title">
            {Array.from(TITLE).map((char, index) => (
              <span
                key={`${char}-${index}`}
                className="welcome-char"
                style={{ ['--i' as string]: index }}
              >
                {char}
              </span>
            ))}
          </h1>
          <p className="welcome-hint">点击任意处跳过</p>
        </div>
      </div>
    </div>
  );
}
