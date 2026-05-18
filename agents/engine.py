"""
AuthAgent — Core Agent Engine
Orchestrates all 4 agents with MoE routing and Claude Vision OCR.
"""

import anthropic
import base64
import json
import re
from typing import AsyncGenerator
from agents.prompts import (
    ORCHESTRATOR_PROMPT,
    CRITERIA_AGENT_PROMPT,
    AUDIT_AGENT_PROMPT,
    DRAFTING_AGENT_PROMPT,
    VISION_PREPROCESSOR_PROMPT,
)
from tools.criteria_loader import load_criteria, classify_domain

client = anthropic.Anthropic()


# ─────────────────────────────────────────────
# VISION PREPROCESSOR
# ─────────────────────────────────────────────
def run_vision_ocr(file_bytes: bytes, media_type: str) -> dict:
    """
    Takes image or PDF bytes, runs through Claude Vision,
    returns structured extracted text and metadata.
    """
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")

    # Claude Vision supports: image/jpeg, image/png, image/gif, image/webp
    # For PDFs we use document type
    if media_type == "application/pdf":
        content = [
            {
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
            },
            {
                "type": "text",
                "text": "Extract all text and metadata from this document. Return ONLY valid JSON matching your output format specification.",
            },
        ]
    else:
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64},
            },
            {
                "type": "text",
                "text": "Extract all text and metadata from this document image. Return ONLY valid JSON matching your output format specification.",
            },
        ]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=VISION_PREPROCESSOR_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    raw = response.content[0].text
    return _safe_parse_json(raw)


# ─────────────────────────────────────────────
# CRITERIA AGENT
# ─────────────────────────────────────────────
def run_criteria_agent(domain: str, request_type: str, institution: str, denial_reason: str = "") -> dict:
    """
    Retrieves and structures the exact criteria checklist
    for this domain + institution + request type.
    MoE: injects domain-specific knowledge base into context.
    """
    # MoE: Load the domain knowledge base
    domain_criteria = load_criteria(domain, request_type)

    user_message = f"""
Domain: {domain}
Institution: {institution or "Unknown — use standard industry criteria"}
Request type: {request_type}
Denial reason (if appeal): {denial_reason or "N/A — this is a new submission"}

Domain knowledge base loaded for context:
{json.dumps(domain_criteria, indent=2)}

Based on this domain knowledge and your expertise, extract and return the complete criteria checklist for this specific case. Return ONLY valid JSON.
"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=CRITERIA_AGENT_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text
    return _safe_parse_json(raw)


# ─────────────────────────────────────────────
# AUDIT AGENT
# ─────────────────────────────────────────────
def run_audit_agent(criteria: dict, documents_text: str, domain: str, denial_reason: str = "") -> dict:
    """
    Cross-references every criterion against available documents.
    Returns confirmed/partial/missing for each with citations.
    """
    user_message = f"""
Domain: {domain}
Denial reason (if applicable): {denial_reason or "N/A"}

CRITERIA CHECKLIST TO AUDIT AGAINST:
{json.dumps(criteria, indent=2)}

AVAILABLE DOCUMENTS (extracted text):
{documents_text}

Perform a thorough evidence audit of every criterion. Return ONLY valid JSON.
"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=3000,
        system=AUDIT_AGENT_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text
    return _safe_parse_json(raw)


# ─────────────────────────────────────────────
# DRAFTING AGENT
# ─────────────────────────────────────────────
def run_drafting_agent(
    mode: str,
    domain: str,
    audit_report: dict,
    original_document: str,
    institution: str,
    criteria: dict,
) -> dict:
    """
    Drafts the appeal letter or new submission.
    Evidence-mapped, criteria-aligned, ready for human review.
    """
    user_message = f"""
Mode: {mode}
Domain: {domain}
Institution: {institution}

AUDIT REPORT FROM AUDITINGAGENT:
{json.dumps(audit_report, indent=2)}

CRITERIA CHECKLIST:
{json.dumps(criteria, indent=2)}

ORIGINAL DOCUMENT:
{original_document}

Draft the complete {mode} letter/document. Return ONLY valid JSON.
"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=3000,
        system=DRAFTING_AGENT_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text
    return _safe_parse_json(raw)


# ─────────────────────────────────────────────
# ORCHESTRATOR — MAIN REACT LOOP
# Streams events for live UI
# ─────────────────────────────────────────────
async def run_orchestrator(
    document_text: str,
    user_context: str,
    mode: str = "auto",
) -> AsyncGenerator[dict, None]:
    """
    Main ReAct loop. Yields SSE events for each agent step.
    Frontend streams these as live blocks.
    """

    # ── Step 0: Classify domain and mode ──────
    yield _event("thought", "OrchestratorAgent", "Classifying domain and mode",
        f"Analysing the input document and context. I need to identify: (1) the domain this belongs to, (2) whether this is a denial review or new submission, (3) the institution involved, and (4) the specific request type.")

    domain, institution, request_type, detected_mode = _classify_input(document_text, user_context)
    if mode == "auto":
        mode = detected_mode

    yield _event("observation", "OrchestratorAgent", f"Domain identified: {domain}",
        f"Domain: {domain.upper()} | Mode: {mode.replace('_', ' ').title()} | Institution: {institution or 'Unknown'} | Request: {request_type}")

    # ── Step 1: Extract denial reason if review ──
    denial_reason = ""
    if mode == "review_denial":
        yield _event("thought", "OrchestratorAgent", "Extracting denial reason",
            f"This is a denial review. I need to extract the exact criterion the institution cited as the reason for denial. This is critical — the entire appeal strategy depends on addressing the stated reason precisely.")
        denial_reason = _extract_denial_reason(document_text)
        yield _event("observation", "OrchestratorAgent", "Denial reason extracted",
            f"Stated denial reason: {denial_reason}")

    # ── Step 2: Dispatch CriteriaAgent ───────────
    yield _event("action", "OrchestratorAgent", "Dispatching CriteriaAgent",
        f"Dispatching CriteriaAgent with domain={domain}, institution={institution}, request_type={request_type}. CriteriaAgent will load the domain knowledge base (MoE) and return the exact criteria checklist this institution requires.")

    try:
        criteria = run_criteria_agent(domain, request_type, institution, denial_reason)
        criteria_count = len(criteria.get("criteria", []))
        yield _event("observation", "CriteriaAgent", f"Retrieved {criteria_count} criteria",
            f"Criteria checklist complete. {criteria_count} criteria identified. Policy reference: {criteria.get('policy_reference', 'Standard criteria')}. Mandatory items: {sum(1 for c in criteria.get('criteria', []) if c.get('mandatory', True))}.")
    except Exception as e:
        yield _event("thought", "OrchestratorAgent", "CriteriaAgent error — using fallback",
            f"CriteriaAgent returned an error: {str(e)}. Falling back to domain standard criteria.")
        criteria = {"criteria": [], "error": str(e)}

    # ── Step 3: Dispatch AuditAgent ──────────────
    yield _event("thought", "OrchestratorAgent", "Planning evidence audit",
        f"CriteriaAgent returned {len(criteria.get('criteria', []))} criteria. Now I dispatch AuditAgent to cross-reference each criterion against the user's available documents. AuditAgent must return confirmed/partial/missing for each item with exact citations.")

    yield _event("action", "OrchestratorAgent", "Dispatching AuditAgent",
        f"AuditAgent receiving: criteria checklist ({len(criteria.get('criteria', []))} items) + extracted document text ({len(document_text)} chars) + denial reason. Executing evidence cross-reference...")

    try:
        audit = run_audit_agent(criteria, document_text + "\n\n" + user_context, domain, denial_reason)
        summary = audit.get("audit_summary", {})
        confirmed = summary.get("confirmed", 0)
        missing = summary.get("missing", 0)
        blocking = summary.get("blocking_gaps", 0)

        yield _event("observation", "AuditAgent", f"Audit complete — {confirmed} confirmed, {missing} missing",
            f"Evidence audit finished. Confirmed: {confirmed} | Partial: {summary.get('partial', 0)} | Missing: {missing} | Blocking gaps: {blocking} | Overall readiness: {summary.get('overall_readiness', 'N/A')}")

        if blocking > 0:
            gaps = audit.get("critical_gaps", [])
            gap_text = " | ".join([f"{g.get('criterion_id', '')}: {g.get('gap', '')[:80]}" for g in gaps[:3]])
            yield _event("thought", "OrchestratorAgent", f"Detected {blocking} blocking gap(s)",
                f"There are {blocking} blocking gaps that could prevent approval: {gap_text}. I will instruct DraftingAgent to address confirmed evidence, flag all gaps explicitly, and provide clear remediation steps for the user.")
        else:
            yield _event("thought", "OrchestratorAgent", "Strong evidence profile — proceeding to draft",
                f"All mandatory criteria have sufficient evidence. Confidence is high. Dispatching DraftingAgent to produce the final document.")

    except Exception as e:
        yield _event("thought", "OrchestratorAgent", "AuditAgent error — proceeding with available data",
            f"AuditAgent error: {str(e)}. Proceeding with available document text.")
        audit = {"audit_summary": {}, "evidence_audit": [], "critical_gaps": []}

    # ── Step 4: Dispatch DraftingAgent ───────────
    yield _event("action", "OrchestratorAgent", "Dispatching DraftingAgent",
        f"DraftingAgent receiving: audit report + criteria checklist + original document. Mode: {mode}. Domain: {domain}. Institution: {institution}. Drafting the complete {'appeal letter' if mode == 'review_denial' else 'submission package'}...")

    try:
        draft = run_drafting_agent(mode, domain, audit, document_text, institution or "the institution", criteria)
        word_count = draft.get("word_count", "N/A")
        confidence = draft.get("drafting_confidence", "N/A")
        flags = draft.get("human_review_flags", [])

        yield _event("observation", "DraftingAgent", f"Draft complete — {word_count} words, {confidence}% confidence",
            f"Letter drafted. Word count: {word_count} | Drafting confidence: {confidence}% | Human review flags: {len(flags)} item(s) requiring attention before submission.")

    except Exception as e:
        yield _event("thought", "OrchestratorAgent", "DraftingAgent error",
            f"DraftingAgent error: {str(e)}.")
        draft = {"letter_body": "Draft generation failed — please retry.", "human_review_flags": []}

    # ── Step 5: Final synthesis ──────────────────
    overall_confidence = _calculate_confidence(criteria, audit, draft)

    yield _event("synthesis", "OrchestratorAgent", "Synthesising final output",
        f"All specialist agents complete. Synthesising results. Domain: {domain} | Mode: {mode} | Criteria coverage: {audit.get('audit_summary', {}).get('overall_readiness', 'N/A')} | System confidence: {overall_confidence}% | Human review required: YES — review all flagged items before submission.")

    # ── Yield final structured output ────────────
    yield _event("output", "AuthAgent", "Complete — ready for human review", json.dumps({
        "domain": domain,
        "mode": mode,
        "institution": institution,
        "request_type": request_type,
        "criteria": criteria,
        "audit": audit,
        "draft": draft,
        "confidence_score": overall_confidence,
        "denial_reason": denial_reason,
    }))


# ─────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────
def _event(event_type: str, agent: str, title: str, content: str) -> dict:
    return {"type": event_type, "agent": agent, "title": title, "content": content}


def _safe_parse_json(raw: str) -> dict:
    """Robustly parse JSON from LLM output."""
    cleaned = re.sub(r"```json|```", "", raw).strip()
    # Find JSON boundaries
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(cleaned[start:end])
        except json.JSONDecodeError:
            pass
    # Return raw as fallback
    return {"raw_output": raw, "parse_error": True}


def _classify_input(document_text: str, user_context: str) -> tuple:
    """Quick classification without a full agent call."""
    combined = (document_text + " " + user_context).lower()

    # Domain detection
    domain = "healthcare"
    if any(w in combined for w in ["visa", "immigration", "home office", "skilled worker", "uscis", "passport", "sponsor"]):
        domain = "legal_visa"
    elif any(w in combined for w in ["loan", "mortgage", "credit", "bank", "underwriting", "overdraft", "finance"]):
        domain = "finance"
    elif any(w in combined for w in ["grant", "funding", "funder", "foundation", "charity", "ngo", "subsidy"]):
        domain = "grants"
    elif any(w in combined for w in ["claim", "adjuster", "settlement", "policy", "damage", "insurer"] ) and \
         not any(w in combined for w in ["prior auth", "clinical", "diagnosis", "medication"]):
        domain = "insurance_claim"

    # Institution detection
    institution = ""
    for inst in ["bluecross", "aetna", "cigna", "humana", "unitedhealthcare", "barclays",
                 "lloyds", "hsbc", "home office", "uscis", "wellcome", "gates"]:
        if inst in combined:
            institution = inst.title()
            break

    # Request type
    request_type = "general approval request"
    if "prior auth" in combined or "prior authorization" in combined:
        if any(w in combined for w in ["adalimumab", "humira", "biologic", "dmard", "rheumat"]):
            request_type = "biologics_rheumatology"
        else:
            request_type = "biologics_rheumatology"  # default PA to biologics
    elif "mri" in combined:
        request_type = "imaging_mri"
    elif "skilled worker" in combined or "tier 2" in combined:
        request_type = "uk_skilled_worker_visa"
    elif "business loan" in combined or "sme loan" in combined:
        request_type = "sme_business_loan"

    # Mode detection
    mode = "review_denial"
    denial_words = ["denied", "denial", "not approved", "does not meet", "rejected", "rejection", "unable to approve"]
    new_words = ["new request", "please check", "pre-check", "before i submit", "preparing", "planning to apply"]
    if any(w in combined for w in new_words):
        mode = "new_submission"
    elif not any(w in combined for w in denial_words):
        mode = "new_submission"

    return domain, institution, request_type, mode


def _extract_denial_reason(document_text: str) -> str:
    """Extract the specific denial reason from a denial letter."""
    text_lower = document_text.lower()
    # Look for common denial reason patterns
    patterns = [
        r"reason for denial[:\s]+([^\.]+\.)",
        r"denied because[:\s]+([^\.]+\.)",
        r"does not meet[:\s]+([^\.]+\.)",
        r"not approved[:\s]+([^\.]+\.)",
        r"clinical documentation[^\n]+([^\n]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            return match.group(1).strip()[:300]
    # Fallback: return first 200 chars after "denial" keyword
    idx = text_lower.find("denial")
    if idx > 0:
        return document_text[idx:idx+200].strip()
    return "Denial reason not explicitly stated — full document analysis required"


def _calculate_confidence(criteria: dict, audit: dict, draft: dict) -> int:
    """Calculate overall system confidence score."""
    base = 70
    summary = audit.get("audit_summary", {})
    total = summary.get("total_criteria", 1)
    confirmed = summary.get("confirmed", 0)
    blocking = summary.get("blocking_gaps", 0)

    if total > 0:
        base = int((confirmed / total) * 100)
    if blocking > 0:
        base -= (blocking * 10)
    draft_conf = draft.get("drafting_confidence", 80)
    return max(20, min(98, int((base + draft_conf) / 2)))
