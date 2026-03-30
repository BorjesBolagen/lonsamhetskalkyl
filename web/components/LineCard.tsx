import { ReactNode } from "react";

type CardProps = {
  title: string;
  children: ReactNode;
};

export default function LineCard({ title, children }: CardProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 space-y-4 max-w-2xl w-full">

      {/* Titel */}
      <h2 className="text-lg font-bold text-gray-800 border-b pb-2">
        {title}
      </h2>

      {/* Cards */}
      <div className="flex flex-wrap gap-4">
        {children}
      </div>
    </div>
  );
}