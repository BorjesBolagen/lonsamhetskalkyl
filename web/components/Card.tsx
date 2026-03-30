import { ReactNode } from "react";
import Bar from "./Bar";

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
    <div className="bg-gray-300 rounded-xl shadow-sm p-4 w-36 flex flex-col items-center hover:shadow-md transition">

      {/* Titel */}
      <div className="bg-green-600 text-white text-sm font-semibold px-3 py-1 rounded-md mb-3 w-full text-center">
        {title}
      </div>

      {/* FLM */}
      <p className="text-xs text-gray-600">FLM</p>
      <Bar progress={capacity} />

      {/* Profit */}
      <p className="text-xs text-gray-600 mt-1">Profit</p>
      <Bar progress={price} />

      {/* Button */}
      <div className="mt-2 w-full text-center">
        {children}
      </div>
    </div>
  );
}