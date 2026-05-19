"use client";

import { SCENARIOS } from "@/lib/scenarios";
import { Domain, Mode, Scenario } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOMAINS: { value: Domain; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "healthcare", label: "Healthcare" },
  { value: "legal_visa", label: "Legal / Visa" },
  { value: "finance", label: "Finance" },
  { value: "grants", label: "Grants" },
  { value: "insurance_claim", label: "Insurance" },
];

const AGENTS = [
  { name: "OrchestratorAgent", desc: "Plans ReAct loop · dispatches · synthesises" },
  { name: "CriteriaAgent + MoE", desc: "Loads domain knowledge · extracts checklist" },
  { name: "AuditAgent", desc: "Cross-references evidence · flags gaps" },
  { name: "DraftingAgent", desc: "Writes the letter that gets the yes" },
];

interface Props {
  mode: Mode;
  domain: Domain;
  onModeChange: (m: Mode) => void;
  onDomainChange: (d: Domain) => void;
  onScenario: (s: Scenario) => void;
  activeScenario: string | null;
}

export function Sidebar({ mode, domain, onModeChange, onDomainChange, onScenario, activeScenario }: Props) {
  return (
    <aside className="bg-ink-2 border-r border-white/[0.06] flex flex-col overflow-y-auto">

      {/* Mode */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-mono tracking-[0.12em] uppercase text-ghost">Mode</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
        <div className="grid grid-cols-2 gap-1 bg-ink-3 rounded-lg p-1">
          <button
            onClick={() => onModeChange("review_denial")}
            className={cn(
              "py-2 px-2 rounded-md text-[11px] font-medium transition-all text-center leading-tight",
              mode === "review_denial"
                ? "bg-violet text-white shadow-[0_0_16px_rgba(124,111,212,0.25)]"
                : "text-ghost hover:text-fog"
            )}
          >
            📋 Review denial
          </button>
          <button
            onClick={() => onModeChange("new_submission")}
            className={cn(
              "py-2 px-2 rounded-md text-[11px] font-medium transition-all text-center leading-tight",
              mode === "new_submission"
                ? "bg-violet text-white shadow-[0_0_16px_rgba(124,111,212,0.25)]"
                : "text-ghost hover:text-fog"
            )}
          >
            ✨ New request
          </button>
        </div>
      </div>

      {/* Domain */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-mono tracking-[0.12em] uppercase text-ghost">Domain</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DOMAINS.map(d => (
            <button
              key={d.value}
              onClick={() => onDomainChange(d.value)}
              className={cn(
                "px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all",
                domain === d.value
                  ? "border-jade bg-jade/10 text-jade"
                  : "border-white/10 text-ghost hover:border-white/20 hover:text-fog"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scenarios */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-mono tracking-[0.12em] uppercase text-ghost">Try a scenario</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
        <div className="flex flex-col gap-1.5">
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              onClick={() => onScenario(s)}
              className={cn(
                "flex items-start gap-2.5 p-3 rounded-lg border text-left text-[12px] transition-all",
                activeScenario === s.key
                  ? "border-jade/50 bg-jade/5 text-jade"
                  : "border-white/[0.06] bg-ink-3 text-fog hover:border-white/10 hover:text-snow"
              )}
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: s.dotColor }}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-mono tracking-[0.12em] uppercase text-ghost">Agent architecture</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
        <div className="flex flex-col gap-1.5">
          {AGENTS.map(a => (
            <div key={a.name} className="bg-ink-3 border border-white/[0.06] rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-violet-soft mb-0.5">{a.name}</div>
              <div className="text-[11px] text-ghost leading-snug">{a.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-2 bg-ink-3 rounded-lg border border-white/[0.06]">
          <div className="text-[10px] font-mono text-ghost mb-0.5">Powered by</div>
          <div className="text-[11px] text-fog">Gemini 2.0 Flash + 1.5 Pro</div>
        </div>
      </div>

    </aside>
  );
}
