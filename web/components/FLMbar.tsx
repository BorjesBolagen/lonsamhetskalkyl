type Property = {
  progress: number;
};

export default function FLMbar({ progress }: Property) {
  const isFull = progress >= 100;

  return (
    <div className="w-full h-2 bg-[var(--primary-element)] rounded-full overflow-hidden mb-2">
      <div
        className={`h-full transition-all duration-300 ${
          isFull ? "bg-[#CF6679]" : "bg-green-400"
        }`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}