"use client";

export function TypingBubble({
  names,
  showName,
}: {
  names: string[];
  showName: boolean;
}) {
  const label =
    names.length > 1
      ? `${names.length} people are typing`
      : names[0]
        ? `${names[0]} is typing`
        : "Someone is typing";

  return (
    <div className="flex justify-start" role="status" aria-label={label}>
      <div className="my-0.5 rounded-md border border-[#e2e5e9] bg-white px-3.5 py-2.5 shadow-[0_2px_7px_rgba(24,36,58,0.06)]">
        {showName ? (
          <p className="mb-1 text-[10px] font-bold text-[#16803c]">{label}</p>
        ) : null}
        <div className="flex h-4 items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#86909f]"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
