"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * En informationsbubbla som man kan sväva med musen ovan för att se mer information.
 * Renders the visible tooltip in a portal to avoid being clipped by overflow parents.
 */
export function InfoTooltip({
  text,
  align = "center",
}: {
  text: string;
  align?: "left" | "center" | "right";
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onEnter = () => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setVisible(true);
  };

  const onLeave = () => setVisible(false);

  return (
    <span
      ref={anchorRef}
      onMouseEnter={onEnter}
      onFocus={onEnter}
      onMouseLeave={onLeave}
      onBlur={onLeave}
      className="relative inline-flex items-center cursor-help"
    >
      <span className="text-[var(--text-secondary)] opacity-40 hover:opacity-70 transition-opacity">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>

      {visible &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -100%)",
            }}
            className={`w-52 text-xs leading-relaxed text-[var(--text-primary)] bg-[var(--primary-element)] border border-[var(--border-secondary)] rounded-md shadow-md px-3 py-2 pointer-events-none z-[99999] normal-case font-normal whitespace-pre-line`}
          >
            {text}
            <span
              style={{ position: "absolute", left: "50%", top: "100%", transform: "translateX(-50%)" }}
              className="border-4 border-transparent border-t-[var(--border-primary)]"
            />
          </div>,
          document.body,
        )}
    </span>
  );
}