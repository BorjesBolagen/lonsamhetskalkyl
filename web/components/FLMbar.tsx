type Property = {
  progress: number;
};

export default function FLMbar({ progress }: Property) {
  const isFull = progress >= 100;

  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
      <div
        className={`h-full transition-all duration-300 ${
          isFull ? "bg-red-500" : "bg-green-500"
        }`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}