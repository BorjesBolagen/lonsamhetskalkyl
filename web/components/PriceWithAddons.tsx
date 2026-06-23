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

type PriceBreakdownValue = {
  step_used?: number | null;
  estimated_revenue?: number | null;
  base_revenue?: number | null;
  addon_total?: number | null;
  addons?: ProfitabilityAddon[] | null;
  detail?: string | null;
};

type PriceWithAddonsProps = {
  value: PriceBreakdownValue;
  className?: string;
};

type TooltipPosition = {
  left: number;
  top: number;
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

  const [isTooltipOpen, setIsTooltipOpen] =
    useState(false);

  const [tooltipPosition, setTooltipPosition] =
    useState<TooltipPosition>({
      left: 0,
      top: 0,
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

  function updateTooltipPosition() {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect =
      button.getBoundingClientRect();

    let left =
      rect.right + TOOLTIP_MARGIN;

    if (
      left + TOOLTIP_WIDTH
      > window.innerWidth - TOOLTIP_MARGIN
    ) {
      left =
        rect.left
        - TOOLTIP_WIDTH
        - TOOLTIP_MARGIN;
    }

    left = Math.max(
      TOOLTIP_MARGIN,
      left,
    );

    const estimatedHeight =
      140 + Math.max(addons.length, 1) * 28;

    let top = rect.top;

    if (
      top + estimatedHeight
      > window.innerHeight - TOOLTIP_MARGIN
    ) {
      top =
        window.innerHeight
        - estimatedHeight
        - TOOLTIP_MARGIN;
    }

    top = Math.max(
      TOOLTIP_MARGIN,
      top,
    );

    setTooltipPosition({
      left,
      top,
    });
  }

  function openTooltip() {
    updateTooltipPosition();
    setIsTooltipOpen(true);
  }

  function closeTooltip() {
    setIsTooltipOpen(false);
  }

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
        onMouseLeave={closeTooltip}
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
              width: TOOLTIP_WIDTH,
            }}
            className="
              pointer-events-none
              fixed z-[9999]
              rounded-xl
              border border-[var(--border-primary)]
              bg-[var(--primary-element)]
              p-3
              text-left text-xs
              text-[var(--text-primary)]
              shadow-xl
            "
          >
            <div className="flex items-center justify-between gap-5">
              <span className="font-medium">
                Pris utan tillägg
              </span>

              <span className="shrink-0 font-semibold">
                {formatSek(baseRevenue)} kr
              </span>
            </div>

            <div className="my-2 border-t border-[var(--border-primary)]" />

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
                Pris inklusive tillägg
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
