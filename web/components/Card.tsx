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
    <div className="bg-[#585858] rounded-xl shadow-sm p-2 w-36 flex flex-col items-center hover:shadow-md transition">

      {/* Titel */}
      <div className="bg-gray-800 text-gray-300 text-sm font-semibold px-3 py-2 rounded-md mb-3 w-full text-center">
        {title}
      </div>

      {/* FLM */}
      <p className="text-xs text-gray-300">FLM</p>
      <FLMbar progress={capacity} />

      {/* Pris */}
      <p className="text-xs text-gray-900 mt-1">Pris</p>
      <Pricebar progress={price} />

      {/* Button */}
      <div className="bg-[#242424] mt-2 w-full text-center text-white px-2 py-1 rounded hover:bg-gray-500 transition text-sm">
        {children}
      </div>
    </div>
  );
}