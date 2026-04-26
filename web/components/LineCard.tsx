import { ReactNode } from "react";

type LineCardProps = {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export default function LineCard({
  title,
  children,
  onRefresh,
  isRefreshing = false,
}: LineCardProps) {
  return (
    <div className="bg-[var(--primary-element)] rounded-xl shadow-md p-6 space-y-4 w-full max-w-[52rem]">
      {/* Title for the grouped line section. */}
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          {title}
        </h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="bg-[var(--button-fetch)] px-2 py-1 rounded hover:bg-[var(--button-fetch-hover)] transition text-[var(--text-primary)] disabled:opacity-50"
          >
            {isRefreshing ? (
              <span className="inline-block w-4 h-4 border-2 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>↻</span>
            )}
          </button>
        )}
      </div>

      {/* Cards are allowed to wrap, but the container is wide enough for five per row. */}
      <div className="flex flex-wrap gap-4 items-start">{children}</div>
    </div>
  );
}
