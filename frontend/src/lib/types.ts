export type EventType = "thought" | "action" | "observation" | "synthesis" | "output" | "error";

export interface AgentEvent {
  type: EventType;
  agent: string;
  title: string;
  content: string;
}

export interface AuditItem {
  criterion_id: string;
  criterion: string;
  status: "confirmed" | "partial" | "missing";
  evidence_found?: string;
  source?: string;
  gap_detail?: string;
  fix_action?: string;
}

export interface Gap {
  criterion_id?: string;
  gap: string;
  severity: "blocking" | "warning";
  fix?: string;
  estimated_time_to_fix?: string;
}

export interface OutputPayload {
  domain: string;
  mode: string;
  institution: string;
  request_type: string;
  confidence_score: number;
  denial_reason?: string;
  audit: {
    audit_summary: {
      total_criteria: number;
      confirmed: number;
      partial: number;
      missing: number;
      blocking_gaps: number;
      overall_readiness: string;
    };
    evidence_audit: AuditItem[];
    critical_gaps: Gap[];
  };
  draft: {
    letter_body: string;
    human_review_flags: string[];
    drafting_confidence: number;
    subject_line?: string;
  };
  criteria: {
    criteria: Array<{ id: string; criterion: string; mandatory: boolean }>;
    policy_reference?: string;
  };
}

export type Domain = "auto" | "healthcare" | "legal_visa" | "finance" | "grants" | "insurance_claim";
export type Mode = "review_denial" | "new_submission";

export interface Scenario {
  key: string;
  label: string;
  domain: Domain;
  mode: Mode;
  dotColor: string;
  text: string;
}
