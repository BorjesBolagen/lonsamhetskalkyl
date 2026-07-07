"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import type {
  ProfitabilityAddon,
} from "../lib/api";
import type { NavResult } from "../profitability/types";

type PriceBreakdownValue = {
  step_used?: number | null;
  estimated_revenue?: number | null;
  base_revenue?: number | null;
  customer_net_revenue?: number | null;
  addon_total?: number | null;
  addons?: ProfitabilityAddon[] | null;
  detail?: string | null;
  nav_ers_exklusive_tillägg?: NavResult | null;
};

type PriceWithAddonsProps = {
  value: PriceBreakdownValue;
  className?: string;
};

type TooltipPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

const TOOLTIP_WIDTH = 320;
const TOOLTIP_MARGIN = 8;

function formatSek(
  value: number,
  maximumFractionDigits = 2,
): string {
  return new Intl.NumberFormat(
    "sv-SE",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    },
  ).format(value);
}

function toNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

function getRegionName(
  region: ProfitabilityAddon["region"],
): string {
  if (region === "stockholm") {
    return "Stockholm";
  }

  if (region === "goteborg") {
    return "Göteborg";
  }

  return "";
}

function getAddonLabel(
  addon: ProfitabilityAddon,
): string {
  if (addon.type === "orttillagg") {
    const direction =
      addon.direction === "from"
        ? "från avsändaren"
        : "till mottagaren";

    const classText =
      addon.class !== null
        ? `, klass ${addon.class}`
        : "";

    return `Orttillägg ${direction}${classText}`;
  }

  if (addon.type === "storstadstillagg") {
    const region =
      getRegionName(addon.region);

    return region
      ? `Storstadstillägg ${region}`
      : "Storstadstillägg";
  }

  if (addon.type === "balanstillagg") {
    const region =
      getRegionName(addon.region);

    return region
      ? `Balanstillägg ${region}`
      : "Balanstillägg";
  }

  if (addon.type === "tidtillagg") {
    return "Tidstillägg";
  }

  if (addon.type === "hvotillagg") {
    return addon.name || "HVO-tillägg";
  }

  if (addon.type === "dmttillagg") {
    return addon.name || "DMT-tillägg";
  }

  if (addon.type === "styckegodstillagg") {
    return addon.name || "Styckegodstillägg";
  }

  return addon.name;
}

/**
 * Visar totalpris och en liten informationssymbol bredvid priset.
 * Tooltipen visar grundpris, tillägg och pris inklusive tillägg.
 */
export default function PriceWithAddons({
  value,
  className = "",
}: PriceWithAddonsProps) {
  const tooltipId = useId();

  const buttonRef =
    useRef<HTMLButtonElement | null>(null);

  const closeTimerRef =
    useRef<number | null>(null);

  const [isTooltipOpen, setIsTooltipOpen] =
    useState(false);

  const [tooltipPosition, setTooltipPosition] =
    useState<TooltipPosition>({
      left: 0,
      top: 0,
      width: TOOLTIP_WIDTH,
      maxHeight: 320,
    });

  const estimatedRevenue =
    toNumber(value.estimated_revenue);

  const addons =
    Array.isArray(value.addons)
      ? value.addons
      : [];

  const calculatedAddonTotal =
    addons.reduce(
      (sum, addon) =>
        sum + toNumber(addon.amount),
      0,
    );

  const addonTotal =
    value.addon_total !== undefined && value.addon_total !== null
      ? toNumber(value.addon_total)
      : calculatedAddonTotal;

  const baseRevenue =
    value.base_revenue !== undefined && value.base_revenue !== null
      ? toNumber(value.base_revenue)
      : estimatedRevenue - addonTotal;

  const hasAddons =
    addonTotal > 0 || addons.length > 0;

  const navEntries = [
    {
      label: "Avgående terminal",
      value: toNumber(
        value.nav_ers_exklusive_tillägg?.avg_term_ers,
      ),
    },
    {
      label: "Ankommande terminal",
      value: toNumber(
        value.nav_ers_exklusive_tillägg?.ank_term_ers,
      ),
    },
    {
      label: "Direktlastat Fjärr",
      value: toNumber(
        value.nav_ers_exklusive_tillägg?.fjarr_ers,
      ),
    },
  ].filter((entry) => entry.value > 0);

  const hasNavValues = navEntries.length > 0;

  const customerNetRevenue =
    value.customer_net_revenue !== undefined
    && value.customer_net_revenue !== null
      ? toNumber(value.customer_net_revenue)
      : hasNavValues
        ? navEntries.reduce(
          (sum, entry) => sum + entry.value,
          0,
        )
        : baseRevenue;

  const firstRowRevenue = hasNavValues
    ? customerNetRevenue
    : baseRevenue;

  const baseRevenueLabel = hasNavValues
    ? "Kundnetto exkl. tillägg"
    : "Pris utan tillägg";

  const totalRevenueLabel = hasNavValues
    ? "Summa totala intäkter"
    : "Pris inklusive tillägg";

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function updateTooltipPosition() {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect =
      button.getBoundingClientRect();

    const width = Math.min(
      TOOLTIP_WIDTH,
      window.innerWidth - TOOLTIP_MARGIN * 2,
    );

    let left =
      rect.right + TOOLTIP_MARGIN;

    if (
      left + width
      > window.innerWidth - TOOLTIP_MARGIN
    ) {
      left =
        rect.left
        - width
        - TOOLTIP_MARGIN;
    }

    left = Math.max(
      TOOLTIP_MARGIN,
      Math.min(
        left,
        window.innerWidth - width - TOOLTIP_MARGIN,
      ),
    );

    const estimatedHeight =
      150
      + (hasNavValues ? navEntries.length * 28 + 48 : 0)
      + Math.max(addons.length, 1) * 28;

    const viewportMaxHeight = Math.max(
      160,
      window.innerHeight - TOOLTIP_MARGIN * 2,
    );

    const renderedHeight = Math.min(
      estimatedHeight,
      viewportMaxHeight,
    );

    let top = rect.top;

    if (
      top + renderedHeight
      > window.innerHeight - TOOLTIP_MARGIN
    ) {
      top =
        window.innerHeight
        - renderedHeight
        - TOOLTIP_MARGIN;
    }

    top = Math.max(
      TOOLTIP_MARGIN,
      top,
    );

    const maxHeight = Math.max(
      160,
      window.innerHeight - top - TOOLTIP_MARGIN,
    );

    setTooltipPosition({
      left,
      top,
      width,
      maxHeight,
    });
  }

  function openTooltip() {
    clearCloseTimer();
    updateTooltipPosition();
    setIsTooltipOpen(true);
  }

  function closeTooltip() {
    clearCloseTimer();
    setIsTooltipOpen(false);
  }

  function scheduleCloseTooltip() {
    clearCloseTimer();

    closeTimerRef.current = window.setTimeout(
      () => {
        setIsTooltipOpen(false);
        closeTimerRef.current = null;
      },
      120,
    );
  }


  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  useEffect(() => {
    if (!isTooltipOpen) {
      return;
    }

    function handleViewportChange() {
      updateTooltipPosition();
    }

    window.addEventListener(
      "resize",
      handleViewportChange,
    );

    window.addEventListener(
      "scroll",
      handleViewportChange,
      true,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleViewportChange,
      );

      window.removeEventListener(
        "scroll",
        handleViewportChange,
        true,
      );
    };
  }, [isTooltipOpen, addons.length]);

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        className,
      ].join(" ")}
    >
      <span>
        {formatSek(estimatedRevenue, 0)} kr
      </span>

      <button
        ref={buttonRef}
        type="button"
        aria-label="Visa prisuppdelning"
        aria-describedby={
          isTooltipOpen
            ? tooltipId
            : undefined
        }
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleCloseTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        className="
          inline-flex h-4 w-4 shrink-0
          items-center justify-center
          rounded-full
          border border-[var(--border-primary)]
          bg-[var(--primary-element)]
          text-[10px] font-bold leading-none
          text-[var(--text-secondary)]
          transition
          hover:bg-[var(--secondary-element)]
          focus:outline-none
          focus:ring-2
          focus:ring-[var(--button-submit)]
        "
      >
        i
      </button>

      {isTooltipOpen
        && typeof document !== "undefined"
        && createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{
              left: tooltipPosition.left,
              top: tooltipPosition.top,
              width: tooltipPosition.width,
              maxHeight: tooltipPosition.maxHeight,
            }}
            className="
              pointer-events-auto
              fixed z-[9999]
              rounded-xl
              border border-[var(--border-primary)]
              bg-[var(--primary-element)]
              p-3
              text-left text-xs
              text-[var(--text-primary)]
              shadow-xl
              overflow-y-auto
              overscroll-contain
            "
            onMouseEnter={openTooltip}
            onMouseLeave={scheduleCloseTooltip}
          >
            <div className="flex items-center justify-between gap-5">
              <span className="font-medium">
                {baseRevenueLabel}
              </span>

              <span className="shrink-0 font-semibold">
                {formatSek(firstRowRevenue)} kr
              </span>
            </div>

            <div className="my-2 border-t border-[var(--border-primary)]" />

            {hasNavValues && (
              <>
                <div className="mb-2 flex items-center justify-between gap-5">
                  <span className="font-medium">
                    NAV-fördelning
                  </span>
                </div>

                <div className="space-y-1.5">
                  {navEntries.map((entry) => (
                    <div
                      key={entry.label}
                      className="flex items-start justify-between gap-5"
                    >
                      <span className="leading-5">
                        {entry.label}
                      </span>

                      <span className="shrink-0 font-medium leading-5">
                        {formatSek(entry.value)} kr
                      </span>
                    </div>
                  ))}
                </div>

                <div className="my-2 border-t border-[var(--border-primary)]" />
              </>
            )}

            <div className="space-y-1.5">
              {addons.length > 0 ? (
                addons.map((addon, index) => (
                  <div
                    key={[
                      addon.id,
                      addon.type,
                      addon.direction,
                      index,
                    ].join("-")}
                    className="flex items-start justify-between gap-5"
                  >
                    <span className="leading-5">
                      {getAddonLabel(addon)}
                    </span>

                    <span className="shrink-0 font-medium leading-5">
                      +{formatSek(addon.amount)} kr
                    </span>
                  </div>
                ))
              ) : hasAddons ? (
                <div className="flex items-center justify-between gap-5">
                  <span>Tillägg</span>

                  <span className="shrink-0 font-medium">
                    +{formatSek(addonTotal)} kr
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-5 text-[var(--text-secondary)]">
                  <span>Inga tillägg applicerade</span>

                  <span className="shrink-0 font-medium">
                    0 kr
                  </span>
                </div>
              )}
            </div>

            <div className="my-2 border-t border-[var(--border-primary)]" />

            <div className="flex items-center justify-between gap-5">
              <span className="font-semibold">
                {totalRevenueLabel}
              </span>

              <span className="shrink-0 font-bold">
                {formatSek(estimatedRevenue)} kr
              </span>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
