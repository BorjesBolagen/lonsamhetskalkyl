import { ReactNode } from "react";

type LineCardProps = {
  title: string;
  children: ReactNode;
};

export default function LineCard({ title, children }: LineCardProps) {
  return (
    <div className="bg-[var(--primary-element)] rounded-xl shadow-md p-6 space-y-4 w-full max-w-[52rem]">
      {/* Title for the grouped line section. */}
      <h2 className="text-lg font-bold text-[var(--text-primary)] border-b pb-2">
        {title}
      </h2>

      {/* Cards are allowed to wrap, but the container is wide enough for five per row. */}
      <div className="flex flex-wrap gap-4 items-start">{children}</div>
    </div>
  );
}
