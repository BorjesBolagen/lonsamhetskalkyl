type Property = {
  progress: number;
};

export default function Pricebar({ progress }: Property) {
  const isFull = progress >= 100;

  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
      <div
        className={`h-full transition-all duration-300 ${
          isFull ? "bg-green-500" : "bg-red-500"
        }`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}