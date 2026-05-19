"use client";

import {
  Check,
  Circle,
  FileText,
  Network,
  PenLine,
  Radar,
  Route,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { AgentEvent, OutputPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  events: AgentEvent[];
  isRunning: boolean;
  output: OutputPayload | null;
  className?: string;
}

type StageId =
  | "input"
  | "orchestrator"
  | "moe"
  | "criteria"
  | "audit"
  | "drafting"
  | "output";

const STAGES: Array<{
  id: StageId;
  label: string;
  sublabel: string;
  agent: string;
  icon: typeof FileText;
  className: string;
  x: number;
  y: number;
}> = [
  {
    id: "input",
    label: "Input",
    sublabel: "Text, PDF, image OCR",
    agent: "VisionPreprocessor",
    icon: FileText,
    className: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
    x: 50,
    y: 8,
  },
  {
    id: "orchestrator",
    label: "Orchestrator",
    sublabel: "Classify, plan, dispatch",
    agent: "OrchestratorAgent",
    icon: Route,
    className: "border-violet/40 bg-violet/15 text-violet-soft",
    x: 50,
    y: 24,
  },
  {
    id: "moe",
    label: "MoE Router",
    sublabel: "Domain knowledge base",
    agent: "CriteriaAgent",
    icon: Network,
    className: "border-jade/35 bg-jade/10 text-jade",
    x: 50,
    y: 40,
  },
  {
    id: "criteria",
    label: "CriteriaAgent",
    sublabel: "Criteria checklist",
    agent: "CriteriaAgent",
    icon: SearchCheck,
    className: "border-jade/45 bg-jade/10 text-jade",
    x: 50,
    y: 56,
  },
  {
    id: "audit",
    label: "AuditAgent",
    sublabel: "Evidence vs requirements",
    agent: "AuditAgent",
    icon: ShieldCheck,
    className: "border-amber/45 bg-amber/10 text-amber",
    x: 50,
    y: 72,
  },
  {
    id: "drafting",
    label: "DraftingAgent",
    sublabel: "Letter and next steps",
    agent: "DraftingAgent",
    icon: PenLine,
    className: "border-crimson/45 bg-crimson/10 text-crimson",
    x: 50,
    y: 88,
  },
  {
    id: "output",
    label: "Output",
    sublabel: "Audit, draft, gaps",
    agent: "AuthAgent",
    icon: Radar,
    className: "border-emerald/45 bg-emerald/10 text-emerald",
    x: 50,
    y: 104,
  },
];

function stageReached(
  stage: StageId,
  events: AgentEvent[],
  output: OutputPayload | null,
) {
  if (stage === "input") return events.length > 0;
  if (stage === "orchestrator")
    return events.some((e) => e.agent === "OrchestratorAgent");
  if (stage === "moe")
    return events.some(
      (e) => e.content.includes("MoE") || e.title.includes("CriteriaAgent"),
    );
  if (stage === "criteria")
    return events.some((e) => e.agent === "CriteriaAgent");
  if (stage === "audit")
    return events.some(
      (e) => e.agent === "AuditAgent" || e.title.includes("AuditAgent"),
    );
  if (stage === "drafting")
    return events.some(
      (e) => e.agent === "DraftingAgent" || e.title.includes("DraftingAgent"),
    );
  return Boolean(output);
}

function stageActive(stage: StageId, latest?: AgentEvent) {
  if (!latest) return false;
  if (stage === "input") return latest.agent === "VisionPreprocessor";
  if (stage === "orchestrator") return latest.agent === "OrchestratorAgent";
  if (stage === "moe") return latest.content.includes("MoE");
  if (stage === "criteria")
    return (
      latest.agent === "CriteriaAgent" || latest.title.includes("CriteriaAgent")
    );
  if (stage === "audit")
    return latest.agent === "AuditAgent" || latest.title.includes("AuditAgent");
  if (stage === "drafting")
    return (
      latest.agent === "DraftingAgent" || latest.title.includes("DraftingAgent")
    );
  return latest.type === "output";
}

export function AgentFlowCanvas({
  events,
  isRunning,
  output,
  className,
}: Props) {
  const latest = events[events.length - 1];
  const eventCount = events.length;

  return (
    <aside
      className={cn(
        "h-full min-h-0 overflow-hidden rounded-xl border border-white/10 bg-ink-2 shadow-[0_18px_70px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            isRunning
              ? "bg-violet animate-pulse"
              : output
                ? "bg-jade"
                : "bg-ghost",
          )}
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-snow">
            Live Agent Canvas
          </div>
          <div className="text-[10px] font-mono text-ghost">
            {eventCount} SSE events received
          </div>
        </div>
        <span className="ml-auto rounded border border-white/10 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-fog">
          {isRunning ? "Streaming" : output ? "Complete" : "Idle"}
        </span>
      </div>

      <div className="relative h-[calc(100%-57px)] min-h-[560px] overflow-auto p-4">
        <div className="relative mx-auto h-[700px] max-w-[360px]">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 112"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="arrow"
                markerHeight="6"
                markerWidth="6"
                orient="auto"
                refX="5"
                refY="3"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="rgba(152,150,180,0.75)" />
              </marker>
            </defs>
            {[18, 34, 50, 66, 82, 98].map((y, i) => (
              <line
                key={y}
                x1="50"
                y1={y}
                x2="50"
                y2={y + 5}
                stroke={
                  eventCount > i
                    ? "rgba(61,191,160,0.72)"
                    : "rgba(255,255,255,0.14)"
                }
                strokeWidth="0.65"
                strokeDasharray={eventCount > i ? "0" : "2 2"}
                markerEnd="url(#arrow)"
              />
            ))}
          </svg>

          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const reached = stageReached(stage.id, events, output);
            const active = stageActive(stage.id, latest);
            return (
              <div
                key={stage.id}
                className={cn(
                  "absolute left-1/2 w-[250px] -translate-x-1/2 rounded-lg border px-3 py-3 transition-all duration-300",
                  stage.className,
                  active &&
                    "scale-[1.03] shadow-[0_0_28px_rgba(124,111,212,0.22)] ring-1 ring-white/15",
                  !reached && !active && "opacity-55 grayscale",
                )}
                style={{ top: `${stage.y}%` }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-current/20 bg-black/15">
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-[13px] font-semibold text-snow">
                        {stage.label}
                      </div>
                      {reached ? (
                        <Check size={13} className="text-jade" />
                      ) : (
                        <Circle size={10} className="text-ghost" />
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-fog">
                      {stage.sublabel}
                    </div>
                    {active && latest && (
                      <div className="mt-2 rounded border border-white/10 bg-black/18 px-2 py-1 text-[10px] font-mono leading-snug text-snow">
                        {latest.type}: {latest.title}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
