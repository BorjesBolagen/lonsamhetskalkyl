type Property = {
  progress: number;
};

export default function Pricebar({ progress }: Property) {
  const clamped = Math.min(Math.max(progress, 0), 100); // get value between 0 and 100
  const hue = (progress / 100) * 120;

  return (
    <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden mb-2">
      <div
        className="h-full transition-all duration-300"
        style={{
          width: `${clamped}%`,
          backgroundColor: `hsl(${hue}, 60%, 50%)`,
        }}
      />
    </div>
  );
}