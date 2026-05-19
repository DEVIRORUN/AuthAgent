"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle, CircleDashed, Copy, RefreshCw, XCircle } from "lucide-react";
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
    if (status === "confirmed") return <CheckCircle size={15} className="text-emerald" />;
    if (status === "missing") return <XCircle size={15} className="text-crimson" />;
    return <CircleDashed size={15} className="text-amber" />;
  };

  const statusBg = (status: string) => {
    if (status === "confirmed") return "bg-emerald/10 border-emerald/20";
    if (status === "missing") return "bg-crimson/10 border-crimson/20";
    return "bg-amber/10 border-amber/20";
  };

  const tabs = [
    { id: "audit" as const, label: "Evidence audit" },
    { id: "letter" as const, label: mode === "review_denial" ? "Appeal letter" : "Submission draft" },
    { id: "gaps" as const, label: `Gaps (${gaps.length + flags.length})` },
  ];

  return (
    <div className="block-animate overflow-hidden rounded-xl border border-jade/50 bg-ink-3 shadow-[0_18px_60px_rgba(0,0,0,0.3)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-jade/20 bg-jade/10 px-4 py-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-jade">
          <CheckCircle size={15} className="text-white" />
        </div>
        <span className="min-w-[220px] flex-1 text-[14px] font-semibold text-snow">
          {mode === "review_denial" ? "Appeal ready for review" : "Submission package complete"} - {domain}
        </span>

        <div className="flex items-center gap-2 rounded-lg border border-jade/20 bg-black/15 px-3 py-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-fog">Confidence</span>
          <span className="text-[16px] font-mono font-semibold text-jade">{confidence_score}%</span>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="h-1 overflow-hidden rounded-full bg-ink">
          <div
            className="h-full rounded-full fill-animate"
            style={{
              width: `${confidence_score}%`,
              background: "linear-gradient(90deg, #7C6FD4, #3DBFA0)",
            }}
          />
        </div>

        {summary.total_criteria && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md border border-emerald/20 bg-emerald/10 px-2 py-1 text-[11px] font-mono text-emerald">{summary.confirmed} confirmed</span>
            <span className="rounded-md border border-amber/20 bg-amber/10 px-2 py-1 text-[11px] font-mono text-amber">{summary.partial} partial</span>
            <span className="rounded-md border border-crimson/20 bg-crimson/10 px-2 py-1 text-[11px] font-mono text-crimson">{summary.missing} missing</span>
            {summary.blocking_gaps > 0 && (
              <span className="ml-auto rounded-md border border-crimson/20 bg-crimson/10 px-2 py-1 text-[11px] font-mono text-crimson">
                {summary.blocking_gaps} blocking
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex border-b border-white/[0.08]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-2.5 text-[12px] font-semibold transition-all ${
              activeTab === tab.id
                ? "border-violet text-snow"
                : "border-transparent text-ghost hover:text-fog"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === "audit" && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {evidenceAudit.length > 0 ? evidenceAudit.map((item, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${statusBg(item.status)}`}>
                <span className="mt-0.5 flex-shrink-0">{statusIcon(item.status)}</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-snow">
                    <span className="mr-1 font-mono text-[10px] text-ghost">{item.criterion_id}</span>
                    {(item.criterion || "").slice(0, 75)}{(item.criterion || "").length > 75 ? "..." : ""}
                  </div>
                  {item.evidence_found && (
                    <div className="mt-1 text-[11px] leading-snug text-snow/75">{item.evidence_found.slice(0, 130)}</div>
                  )}
                </div>
              </div>
            )) : (
              <p className="col-span-2 text-[13px] text-fog">Audit data is still streaming. Expand the observation blocks above for live details.</p>
            )}
          </div>
        )}

        {activeTab === "letter" && (
          <div>
            {draft?.subject_line && (
              <div className="mb-2 text-[11px] font-mono text-ghost">Re: {draft.subject_line}</div>
            )}
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-white/[0.09] bg-ink p-4 font-sans text-[14px] leading-[1.85] text-snow whitespace-pre-wrap">
              {draft?.letter_body || "Draft not available. Check the agent output above."}
            </div>
            <button
              onClick={copyLetter}
              className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-fog transition-all hover:border-white/20 hover:text-snow"
            >
              {copied ? <Check size={13} className="text-jade" /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy letter"}
            </button>
          </div>
        )}

        {activeTab === "gaps" && (
          <div className="space-y-2">
            {gaps.length === 0 && flags.length === 0 && (
              <p className="text-[13px] text-fog">No critical gaps found. Review the letter before sending.</p>
            )}
            {gaps.map((g, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-crimson/20 bg-crimson/10 p-3">
                <span className="mt-0.5 flex-shrink-0 rounded bg-crimson/20 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase text-crimson">
                  {g.severity}
                </span>
                <div>
                  <div className="text-[12px] text-snow/80">{g.gap}</div>
                  {g.fix && <div className="mt-1 text-[12px] font-semibold text-snow">{g.fix}</div>}
                </div>
              </div>
            ))}
            {flags.map((f, i) => (
              <div key={`flag-${i}`} className="flex items-start gap-2 rounded-lg border border-amber/20 bg-amber/10 p-3">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-amber" />
                <span className="text-[12px] text-snow/80">{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.08] px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] font-mono text-amber">
          <AlertTriangle size={11} />
          Expert review required before sending
        </span>
        <button
          onClick={onNewCase}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-ghost transition-colors hover:text-fog"
        >
          <RefreshCw size={11} />
          New case
        </button>
      </div>
    </div>
  );
}
