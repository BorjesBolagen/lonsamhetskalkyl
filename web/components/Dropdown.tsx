import { ConsignmentWithProfitability } from "@/app/home/hooks/homeTypesAndUtils";
import { InfoTooltip } from "@/components/InformationBubble";
import { DEFAULT_NAME_SIMILARITY_THRESHOLD } from "@/lib/backend/constants";
import { useState } from "react";

export type NameSource = "translation" | "jaro" | "base";

function getSourceIcon(source: NameSource): string {
  switch (source) {
    case "translation":
      return "ti-book";
    case "jaro":
      return "ti-star";
    case "base":
      return "ti-user";
  }
}

function getSourceColor(source: NameSource): string {
  switch (source) {
    case "translation":
      return "text-green-400";
    case "jaro":
      return "text-amber-400";
    case "base":
      return "text-blue-400";
  }
}

function getSourceTooltip(source: NameSource): string {
  switch (source) {
    case "translation":
      return "Matchat namn från historisk sändelse. Rekommenderat att användas om detta alternativ finns.";
    case "jaro":
        return `Namn matchat via textlikhet mot historiska kundnamn. Rekommenderas om likheten överstiger ${DEFAULT_NAME_SIMILARITY_THRESHOLD * 100}%.`;
    case "base":
      return "Det ursprungliga kundnamnet från bokningsdata";
  }
}

export function NameDropdown({
  consignment,
  onSelect,
  loading,
}: {
  consignment: ConsignmentWithProfitability;
  onSelect: (name: string, source: NameSource) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  const score = consignment.best_score ?? 0;
  const jaroName = consignment.best_name;
  const translationOptions = consignment.translationOptions ?? [];

  // Build priority list
  const options: { name: string; source: NameSource; label: string }[] = [];
  
  // Add all translation options
  translationOptions.forEach((translationName) => {
    options.push({ name: translationName, source: "translation", label: "Från namn-tabell" });
  });
  
  // Always add jaro match (regardless of threshold)
  if (jaroName) {
    options.push({ name: jaroName, source: "jaro", label: `Matchat namn (${(score * 100).toFixed(0)}%)` });
  }
  
  // Always add original name
  options.push({ name: consignment.customerName, source: "base", label: "Originalnamn" });

  // Display name: use selected name if available, otherwise use highest priority option
  const displayName = consignment.selectedNameForProfitability ?? options[0].name;
  const displaySource = consignment.selectedNameSource ?? options[0].source;

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--text-primary)]">
        <i className="ti ti-loader-2 animate-spin" />
      </span>
    );
  }

  return (
    <div className="relative inline-block w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left text-xs px-2 py-1 rounded border border-[var(--border-primary)] bg-[var(--primary-button)]/20 hover:bg-[var(--primary-button)]/40 text-[var(--text-primary)] transition-colors flex items-center justify-between gap-1"
      >
        <span className="flex items-center gap-1 min-w-0 flex-1">
          <i className={`ti ${getSourceIcon(displaySource)} ${getSourceColor(displaySource)} flex-shrink-0`} />
          <span className="truncate">{displayName}</span>
        </span>
        {options.length > 1 && (
          <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"} text-xs flex-shrink-0`} />
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-max bg-[var(--primary-element)] border border-[var(--border-primary)] rounded shadow-lg">
          {options.map((opt, idx) => (
            <button
              key={`${opt.source}-${idx}`}
              onClick={() => { onSelect(opt.name, opt.source); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--secondary-element)] text-[var(--text-primary)] transition-colors flex items-center justify-between gap-2 border-b last:border-b-0 border-[var(--border-primary)]"
            >
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <i className={`ti ${getSourceIcon(opt.source)} ${getSourceColor(opt.source)} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{opt.name}</div>
                  <div className="text-[var(--text-secondary)] text-xs">{opt.label}</div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <InfoTooltip text={getSourceTooltip(opt.source)} align="right" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}