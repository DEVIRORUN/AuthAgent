"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AgentEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const TAG_CONFIG = {
  thought:     { label: "Thought",     classes: "bg-violet-dim text-violet-soft border border-violet/20" },
  action:      { label: "Action",      classes: "bg-jade-dim text-jade border border-jade/20" },
  observation: { label: "Observation", classes: "bg-amber-dim text-amber border border-amber/20" },
  synthesis:   { label: "Synthesis",   classes: "bg-emerald-dim text-emerald border border-emerald/20" },
  output:      { label: "Output",      classes: "bg-emerald-dim text-emerald border border-emerald/20" },
  error:       { label: "Error",       classes: "bg-crimson-dim text-crimson border border-crimson/20" },
};

interface Props {
  event: AgentEvent;
  index: number;
}

function formatContent(text: string) {
  return text
    .replace(/CONFIRMED/g, '<strong class="text-emerald">CONFIRMED</strong>')
    .replace(/MISSING/g, '<strong class="text-crimson">MISSING</strong>')
    .replace(/PARTIAL/g, '<strong class="text-amber">PARTIAL</strong>')
    .replace(/blocking/gi, '<strong class="text-crimson">blocking</strong>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function ReActBlock({ event, index }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const tag = TAG_CONFIG[event.type] || TAG_CONFIG.thought;

  return (
    <div className={cn(
      "block-animate border border-white/[0.06] rounded-xl overflow-hidden bg-ink-2",
      "transition-all duration-200"
    )}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ink-3 transition-colors"
        style={{ borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Type tag */}
        <span className={cn("text-[9px] font-mono font-medium tracking-widest uppercase px-2 py-0.5 rounded flex-shrink-0", tag.classes)}>
          {tag.label}
        </span>

        {/* Agent */}
        <span className="text-[10px] font-mono text-ghost tracking-wide flex-shrink-0">
          {event.agent}
        </span>

        {/* Title */}
        <span className="text-[13px] font-medium text-snow flex-1 truncate">
          {event.title}
        </span>

        {/* Step number */}
        <span className="text-[10px] font-mono text-ghost flex-shrink-0">
          #{index + 1}
        </span>

        {/* Chevron */}
        <ChevronDown
          size={14}
          className={cn("text-ghost flex-shrink-0 transition-transform duration-200", collapsed && "-rotate-90")}
        />
      </button>

      {!collapsed && (
        <div
          className="px-4 py-3 text-[13px] text-fog leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatContent(event.content) }}
        />
      )}
    </div>
  );
}
