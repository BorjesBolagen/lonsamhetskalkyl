/**
 * En informationsbubbla som man kan sväva med musen ovan för att se mer information
 */
export function InfoTooltip({
  text,
  align = "center",
}: {
  text: string;
  align?: "left" | "center" | "right";
}) {
  const alignmentClasses = {
    center: "left-1/2 -translate-x-1/2",
    left: "left-0",
    right: "right-0",
  };

  return (
    <span className="relative group inline-flex items-center cursor-help">
      {/* Icon */}
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
      {/* Tooltip bubble */}
      <span
        className={`
          absolute bottom-full mb-2 ${alignmentClasses[align]}
          w-52 text-xs leading-relaxed
          text-[var(--text-primary)]
          bg-neutral-100
          border border-[var(--border-primary)]
          rounded-md shadow-md
          px-3 py-2
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          pointer-events-none z-10
          normal-case font-normal
          whitespace-pre-line
        `}
      >
        {text}
        {/* little arrow */}
        <span
          className={`
            absolute top-full
            ${align === "center" ? "left-1/2 -translate-x-1/2" : ""}
            ${align === "left" ? "left-3" : ""}
            ${align === "right" ? "right-3" : ""}
            border-4 border-transparent
            border-t-[var(--border-primary)]
          `}
        />
      </span>
    </span>
  )
}