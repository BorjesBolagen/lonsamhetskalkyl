import { ReactNode } from "react";
import Pricebar from "./pricebar2"
import FLMbar from "./FLMbar";

type CardProps = {
  title: string;
  children: ReactNode;
  capacity: number;
  price: number;
};

export default function Card({
  title,
  children,
  capacity,
  price,
}: CardProps) {
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
      <Pricebar progress={price} />

      {/* Button */}
      <div className="bg-[var(--button-fetch)] mt-2 w-half text-center text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--button-fetch-hover)] transition text-sm">
        {children}
      </div>
    </div>
  );
}