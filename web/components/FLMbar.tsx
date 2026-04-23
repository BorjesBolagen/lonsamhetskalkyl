type Property = {
  progress: number;
};

export default function FLMbar({ progress }: Property) {
  const clamped = Math.min(Math.max(progress, 0), 100);

  // Empty is red, then it moves through orange and yellow before ending in green.
  const hue = (() => {
    if (clamped <= 33) {
      return (clamped / 33) * 30;
    }

    if (clamped <= 66) {
      return 30 + ((clamped - 33) / 33) * 30;
    }

    return 60 + ((clamped - 66) / 34) * 60;
  })();

  return (
    <div className="w-full h-2 bg-[var(--primary-element)] rounded-full overflow-hidden mb-2">
      <div
        className="h-full transition-all duration-300"
        style={{
          width: `${clamped}%`,
          backgroundColor: `hsl(${hue}, 80%, 45%)`,
        }}
      />
    </div>
  );
}
