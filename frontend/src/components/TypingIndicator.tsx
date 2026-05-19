"use client";

export function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="block-animate flex items-center gap-3 px-4 py-3 bg-ink-2 border border-white/[0.06] rounded-xl font-mono text-[11px] text-ghost">
      <div className="flex gap-1 items-center">
        <div className="w-1 h-1 rounded-full bg-violet tdot" />
        <div className="w-1 h-1 rounded-full bg-violet tdot" />
        <div className="w-1 h-1 rounded-full bg-violet tdot" />
      </div>
      <span>{label}</span>
    </div>
  );
}
