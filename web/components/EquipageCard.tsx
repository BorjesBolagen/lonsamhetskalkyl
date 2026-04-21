import { ReactNode } from "react";
import Pricebar from "./pricebar2";
import FLMbar from "./FLMbar";

type EquipageCardProps = {
  title: string;
  children: ReactNode;
  capacity: number;
  price: number;
  priceLoading?: boolean;
};

export default function EquipageCard({
  title,
  children,
  capacity,
  price,
  priceLoading = false,
}: EquipageCardProps) {
  return (
    <div className="bg-[var(--secondary-element)] rounded-xl shadow-sm p-2 w-36 flex flex-col items-center hover:shadow-md transition">

      {/* Titel */}
      <div className="bg-[var(--card-titel)] text-[var(--text-secondary)] text-sm font-semibold px-3 py-2 rounded-md mb-3 w-full text-center">
        {title}
      </div>

      {/* FLM */}
      <p className="text-xs text-[var(--text-secondary)]">FLM</p>
      <FLMbar progress={capacity} />

      {/* Pris */}
      <p className="text-xs text-[var(--text-secondary)] mt-1">Pris</p>
      {priceLoading ? (
        <div className="w-full mt-1">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-300">
            <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gray-500 animate-[price-loading_1.2s_ease-in-out_infinite]" />
          </div>
        </div>
      ) : (
        <Pricebar progress={price} />
      )}

      {/* Button */}
      <div className="bg-[var(--button-fetch)] mt-2 w-half text-center text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--button-fetch-hover)] transition text-sm">
        {children}
      </div>
    </div>
  );
}