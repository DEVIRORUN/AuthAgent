"use client";

import { useState } from "react";
import { CheckCircle, Copy, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { OutputPayload } from "@/lib/types";

interface Props {
  payload: OutputPayload;
  onNewCase: () => void;
}

export function OutputCard({ payload, onNewCase }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"audit" | "letter" | "gaps">("audit");

  const { audit, draft, confidence_score, domain, mode } = payload;
  const summary = audit?.audit_summary || {};
  const evidenceAudit = audit?.evidence_audit || [];
  const gaps = audit?.critical_gaps || [];
  const flags = draft?.human_review_flags || [];

  const copyLetter = () => {
    navigator.clipboard.writeText(draft?.letter_body || "").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusIcon = (status: string) => {
    if (status === "confirmed") return <span className="text-emerald text-[13px]">✓</span>;
    if (status === "missing")   return <span className="text-crimson text-[13px]">✕</span>;
    return <span className="text-amber text-[13px]">◐</span>;
  };

  const statusBg = (status: string) => {
    if (status === "confirmed") return "bg-emerald/5 border-emerald/15";
    if (status === "missing")   return "bg-crimson/5 border-crimson/15";
    return "bg-amber/5 border-amber/15";
  };

  const tabs = [
    { id: "audit" as const, label: "Evidence audit" },
    { id: "letter" as const, label: mode === "review_denial" ? "Appeal letter" : "Submission draft" },
    { id: "gaps" as const, label: `Gaps (${gaps.length + flags.length})` },
  ];

  return (
    <div className="block-animate border border-jade rounded-xl overflow-hidden bg-ink-2"
         style={{ boxShadow: "0 0 40px rgba(61,191,160,0.06)" }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-jade/15"
           style={{ background: "rgba(61,191,160,0.06)" }}>
        <div className="w-6 h-6 rounded-full bg-jade flex items-center justify-center flex-shrink-0">
          <CheckCircle size={13} className="text-white" />
        </div>
        <span className="text-[13px] font-semibold text-jade flex-1">
          {mode === "review_denial" ? "Appeal ready for review" : "Submission package complete"} — {domain}
        </span>

        {/* Confidence */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-ghost">Confidence</span>
          <span className="text-[15px] font-mono font-medium text-jade">{confidence_score}%</span>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="px-4 pt-3 pb-0">
        <div className="h-[3px] rounded-full bg-ink-4 overflow-hidden">
          <div
            className="h-full rounded-full fill-animate"
            style={{
              width: `${confidence_score}%`,
              background: "linear-gradient(90deg, #7C6FD4, #3DBFA0)",
            }}
          />
        </div>

        {/* Summary stats */}
        {summary.total_criteria && (
          <div className="flex gap-4 mt-3 mb-2">
            <span className="text-[11px] font-mono text-emerald">✓ {summary.confirmed} confirmed</span>
            <span className="text-[11px] font-mono text-amber">◐ {summary.partial} partial</span>
            <span className="text-[11px] font-mono text-crimson">✕ {summary.missing} missing</span>
            {summary.blocking_gaps > 0 && (
              <span className="text-[11px] font-mono text-crimson ml-auto">
                ⚠ {summary.blocking_gaps} blocking
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-white/[0.06] mt-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[12px] font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? "text-snow border-violet"
                : "text-ghost border-transparent hover:text-fog"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">

        {/* AUDIT TAB */}
        {activeTab === "audit" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {evidenceAudit.length > 0 ? evidenceAudit.map((item, i) => (
              <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${statusBg(item.status)}`}>
                <span className="mt-0.5 flex-shrink-0">{statusIcon(item.status)}</span>
                <div>
                  <div className="text-[12px] font-medium text-snow mb-0.5">
                    <span className="text-ghost font-mono text-[10px] mr-1">{item.criterion_id}</span>
                    {(item.criterion || "").slice(0, 55)}{(item.criterion || "").length > 55 ? "…" : ""}
                  </div>
                  {item.evidence_found && (
                    <div className="text-[11px] text-fog mt-1 leading-snug">{item.evidence_found.slice(0,100)}</div>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-fog text-[13px] col-span-2">Audit data loading — expand the Observation blocks above for details.</p>
            )}
          </div>
        )}

        {/* LETTER TAB */}
        {activeTab === "letter" && (
          <div>
            {draft?.subject_line && (
              <div className="text-[11px] font-mono text-ghost mb-2">Re: {draft.subject_line}</div>
            )}
            <div className="bg-ink-3 border border-white/[0.06] rounded-lg p-4 text-[13px] text-snow leading-[1.85] whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">
              {draft?.letter_body || "Draft not available — check agent output above."}
            </div>
            <button
              onClick={copyLetter}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-[12px] text-fog hover:text-snow hover:border-white/20 transition-all"
            >
              {copied ? <Check size={13} className="text-jade" /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy letter"}
            </button>
          </div>
        )}

        {/* GAPS TAB */}
        {activeTab === "gaps" && (
          <div className="space-y-2">
            {gaps.length === 0 && flags.length === 0 && (
              <p className="text-fog text-[13px]">No critical gaps found. Review the letter before sending.</p>
            )}
            {gaps.map((g, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-crimson/5 border border-crimson/15 rounded-lg">
                <span className="text-[9px] font-mono font-medium bg-crimson/20 text-crimson px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 uppercase">
                  {g.severity}
                </span>
                <div>
                  <div className="text-[12px] text-fog">{g.gap}</div>
                  {g.fix && <div className="text-[12px] text-snow mt-1 font-medium">→ {g.fix}</div>}
                </div>
              </div>
            ))}
            {flags.map((f, i) => (
              <div key={`flag-${i}`} className="flex items-start gap-2 p-3 bg-amber/5 border border-amber/15 rounded-lg">
                <AlertTriangle size={13} className="text-amber mt-0.5 flex-shrink-0" />
                <span className="text-[12px] text-fog">{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.06]">
        <span className="flex items-center gap-2 text-[11px] font-mono text-amber ml-auto">
          <AlertTriangle size={11} />
          Expert review required before sending
        </span>
        <button
          onClick={onNewCase}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[12px] text-ghost hover:text-fog transition-colors"
        >
          <RefreshCw size={11} />
          New case
        </button>
      </div>
    </div>
  );
}
