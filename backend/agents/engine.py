"""
AuthAgent — Agent Engine (Gemini)
All 4 agents powered by Google Gemini API.
"""

import google.generativeai as genai
import base64
import json
import re
import os
from time import perf_counter
from typing import AsyncGenerator
from dotenv import load_dotenv

from agents.prompts import (
    ORCHESTRATOR_PROMPT,
    CRITERIA_AGENT_PROMPT,
    AUDIT_AGENT_PROMPT,
    DRAFTING_AGENT_PROMPT,
    VISION_PREPROCESSOR_PROMPT,
)
from tools.criteria_loader import load_criteria
from tools.runtime_logger import get_logger

load_dotenv()
logger = get_logger("authagent.engine")

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# Model config — use Flash for speed, Pro for depth
FAST_MODEL = "gemini-2.0-flash"
DEEP_MODEL = "gemini-1.5-pro"


def _call_gemini(system_prompt: str, user_message: str, model: str = FAST_MODEL, agent_name: str = "Gemini") -> str:
    """Single Gemini call — returns text response."""
    start = perf_counter()
    logger.info("%s connecting to %s | prompt_chars=%s", agent_name, model, len(user_message))
    model_instance = genai.GenerativeModel(
        model_name=model,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.2,
            max_output_tokens=4096,
        )
    )
    try:
        response = model_instance.generate_content(user_message)
        logger.info(
            "%s completed %s call | duration=%.2fs | response_chars=%s",
            agent_name,
            model,
            perf_counter() - start,
            len(response.text or ""),
        )
        return response.text
    except Exception:
        logger.exception("%s failed while calling %s | duration=%.2fs", agent_name, model, perf_counter() - start)
        raise


def _call_gemini_vision(system_prompt: str, file_bytes: bytes, media_type: str, prompt: str) -> str:
    """Gemini vision call for images and PDFs."""
    start = perf_counter()
    logger.info(
        "VisionPreprocessor connecting to gemini-1.5-pro | media_type=%s | file_kb=%.1f",
        media_type,
        len(file_bytes) / 1024,
    )
    model_instance = genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        system_instruction=system_prompt,
    )
    part = {"mime_type": media_type, "data": base64.b64encode(file_bytes).decode()}
    try:
        response = model_instance.generate_content([part, prompt])
        logger.info(
            "VisionPreprocessor completed gemini-1.5-pro call | duration=%.2fs | response_chars=%s",
            perf_counter() - start,
            len(response.text or ""),
        )
        return response.text
    except Exception:
        logger.exception("VisionPreprocessor failed while calling gemini-1.5-pro | duration=%.2fs", perf_counter() - start)
        raise


def _safe_json(raw: str) -> dict:
    """Robustly parse JSON from LLM output."""
    cleaned = re.sub(r"```json|```", "", raw).strip()
    # Try object first
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        s = cleaned.find(start_char)
        e = cleaned.rfind(end_char) + 1
        if s >= 0 and e > s:
            try:
                return json.loads(cleaned[s:e])
            except json.JSONDecodeError:
                continue
    return {"raw_output": raw[:500], "parse_error": True}


# ── VISION OCR ───────────────────────────────
def run_vision_ocr(file_bytes: bytes, media_type: str) -> dict:
    logger.info("VisionPreprocessor running OCR pipeline")
    prompt = "Extract all text and metadata. Return ONLY valid JSON matching your output format."
    raw = _call_gemini_vision(VISION_PREPROCESSOR_PROMPT, file_bytes, media_type, prompt)
    return _safe_json(raw)


# ── CRITERIA AGENT ───────────────────────────
def run_criteria_agent(domain: str, request_type: str, institution: str, denial_reason: str = "") -> dict:
    logger.info(
        "CriteriaAgent running | domain=%s | request_type=%s | institution=%s",
        domain,
        request_type,
        institution or "standard",
    )
    domain_criteria = load_criteria(domain, request_type)
    msg = f"""
Domain: {domain}
Institution: {institution or "Unknown — use standard industry criteria"}
Request type: {request_type}
Denial reason: {denial_reason or "N/A"}

Domain knowledge base:
{json.dumps(domain_criteria, indent=2)}

Return the complete criteria checklist. Return ONLY valid JSON.
"""
    raw = _call_gemini(CRITERIA_AGENT_PROMPT, msg, agent_name="CriteriaAgent")
    return _safe_json(raw)


# ── AUDIT AGENT ──────────────────────────────
def run_audit_agent(criteria: dict, documents_text: str, domain: str, denial_reason: str = "") -> dict:
    logger.info(
        "AuditAgent running | domain=%s | criteria=%s | document_chars=%s",
        domain,
        len(criteria.get("criteria", [])),
        len(documents_text),
    )
    msg = f"""
Domain: {domain}
Denial reason: {denial_reason or "N/A"}

CRITERIA CHECKLIST:
{json.dumps(criteria, indent=2)}

AVAILABLE DOCUMENTS:
{documents_text}

Audit every criterion against the documents. Return ONLY valid JSON.
"""
    raw = _call_gemini(AUDIT_AGENT_PROMPT, msg, model=DEEP_MODEL, agent_name="AuditAgent")
    return _safe_json(raw)


# ── DRAFTING AGENT ───────────────────────────
def run_drafting_agent(mode: str, domain: str, audit_report: dict, original_document: str, institution: str, criteria: dict) -> dict:
    logger.info(
        "DraftingAgent running | mode=%s | domain=%s | institution=%s",
        mode,
        domain,
        institution,
    )
    msg = f"""
Mode: {mode}
Domain: {domain}
Institution: {institution}

AUDIT REPORT:
{json.dumps(audit_report, indent=2)}

CRITERIA:
{json.dumps(criteria, indent=2)}

ORIGINAL DOCUMENT:
{original_document}

Draft the complete {mode} document. Return ONLY valid JSON.
"""
    raw = _call_gemini(DRAFTING_AGENT_PROMPT, msg, model=DEEP_MODEL, agent_name="DraftingAgent")
    return _safe_json(raw)


# ── ORCHESTRATOR — MAIN REACT LOOP ──────────
async def run_orchestrator(
    document_text: str,
    user_context: str = "",
    mode: str = "auto",
) -> AsyncGenerator[dict, None]:
    """
    Main ReAct loop. Yields SSE events for live UI streaming.
    """
    run_start = perf_counter()
    logger.info(
        "Orchestrator running | requested_mode=%s | document_chars=%s | context_chars=%s | gemini_key=%s",
        mode,
        len(document_text),
        len(user_context),
        "configured" if GEMINI_API_KEY else "missing",
    )

    def event(etype, agent, title, content):
        return {"type": etype, "agent": agent, "title": title, "content": content}

    # ── Step 0: Classify ─────────────────────
    yield event("thought", "OrchestratorAgent", "Classifying domain and mode",
        "Analysing input. Identifying: domain, mode (review_denial vs new_submission), institution, and request type.")

    domain, institution, request_type, detected_mode = _classify_input(document_text, user_context)
    if mode == "auto":
        mode = detected_mode

    yield event("observation", "OrchestratorAgent", f"Domain identified: {domain.upper()}",
        f"Domain: {domain.upper()} | Mode: {mode.replace('_',' ').title()} | Institution: {institution or 'Unknown'} | Request: {request_type}")

    # ── Step 1: Denial reason ────────────────
    denial_reason = ""
    if mode == "review_denial":
        yield event("thought", "OrchestratorAgent", "Extracting denial reason",
            "Denial review mode. Extracting the exact criterion the institution cited. The entire appeal strategy depends on this.")
        denial_reason = _extract_denial_reason(document_text)
        yield event("observation", "OrchestratorAgent", "Denial reason extracted",
            f"Stated reason: {denial_reason[:300]}")

    # ── Step 2: CriteriaAgent ────────────────
    yield event("action", "OrchestratorAgent", "Dispatching CriteriaAgent",
        f"Dispatching CriteriaAgent → domain={domain}, institution={institution or 'standard'}, request={request_type}. Loading MoE domain knowledge base.")

    try:
        criteria = run_criteria_agent(domain, request_type, institution, denial_reason)
        n = len(criteria.get("criteria", []))
        yield event("observation", "CriteriaAgent", f"Retrieved {n} criteria",
            f"{n} criteria identified. Policy: {criteria.get('policy_reference','Standard')}. Mandatory: {sum(1 for c in criteria.get('criteria',[]) if c.get('mandatory',True))} items.")
    except Exception as e:
        yield event("thought", "OrchestratorAgent", "CriteriaAgent error — using fallback", f"Error: {str(e)[:200]}. Using embedded criteria.")
        criteria = {"criteria": [], "error": str(e)[:200]}

    # ── Step 3: AuditAgent ───────────────────
    yield event("thought", "OrchestratorAgent", "Planning evidence audit",
        f"Criteria retrieved. Dispatching AuditAgent to cross-reference each criterion against user documents. Must return confirmed/partial/missing with exact citations.")

    yield event("action", "OrchestratorAgent", "Dispatching AuditAgent",
        f"AuditAgent receiving {len(criteria.get('criteria',[]))} criteria + {len(document_text)} chars of documents. Executing forensic evidence cross-reference...")

    try:
        audit = run_audit_agent(criteria, document_text + "\n\n" + user_context, domain, denial_reason)
        s = audit.get("audit_summary", {})
        confirmed = s.get("confirmed", 0)
        missing = s.get("missing", 0)
        blocking = s.get("blocking_gaps", 0)
        yield event("observation", "AuditAgent", f"Audit complete — {confirmed} confirmed, {missing} missing",
            f"Confirmed: {confirmed} | Partial: {s.get('partial',0)} | Missing: {missing} | Blocking gaps: {blocking} | Readiness: {s.get('overall_readiness','N/A')}")

        if blocking > 0:
            gaps = audit.get("critical_gaps", [])
            gap_text = " | ".join([f"{g.get('criterion_id','')}: {g.get('gap','')[:60]}" for g in gaps[:3]])
            yield event("thought", "OrchestratorAgent", f"{blocking} blocking gap(s) found",
                f"Gaps: {gap_text}. DraftingAgent will address confirmed evidence, flag all gaps explicitly, and provide remediation steps.")
        else:
            yield event("thought", "OrchestratorAgent", "Strong evidence — proceeding to draft",
                "All mandatory criteria evidenced. High confidence. Dispatching DraftingAgent.")
    except Exception as e:
        yield event("thought", "OrchestratorAgent", "AuditAgent error", f"Error: {str(e)[:200]}. Proceeding with available data.")
        audit = {"audit_summary": {}, "evidence_audit": [], "critical_gaps": []}

    # ── Step 4: DraftingAgent ────────────────
    yield event("action", "OrchestratorAgent", "Dispatching DraftingAgent",
        f"DraftingAgent drafting {'appeal letter' if mode == 'review_denial' else 'new submission'} for {institution or 'institution'}. Criteria-mapped, evidence-cited, ready for human review.")

    try:
        draft = run_drafting_agent(mode, domain, audit, document_text, institution or "the institution", criteria)
        wc = draft.get("word_count", "N/A")
        conf = draft.get("drafting_confidence", "N/A")
        flags = draft.get("human_review_flags", [])
        yield event("observation", "DraftingAgent", f"Draft complete — {wc} words, {conf}% confidence",
            f"Letter drafted. Words: {wc} | Confidence: {conf}% | Review flags: {len(flags)} items requiring human attention before submission.")
    except Exception as e:
        yield event("thought", "OrchestratorAgent", "DraftingAgent error", f"Error: {str(e)[:200]}")
        draft = {"letter_body": "Draft failed — please retry.", "human_review_flags": []}

    # ── Step 5: Synthesis ────────────────────
    confidence = _calc_confidence(criteria, audit, draft)
    yield event("synthesis", "OrchestratorAgent", "Synthesising final output",
        f"All agents complete. Domain: {domain} | Mode: {mode} | Readiness: {audit.get('audit_summary',{}).get('overall_readiness','N/A')} | System confidence: {confidence}% | Human review: REQUIRED before submission.")

    yield event("output", "AuthAgent", "Complete — ready for human review", json.dumps({
        "domain": domain, "mode": mode, "institution": institution,
        "request_type": request_type, "criteria": criteria,
        "audit": audit, "draft": draft,
        "confidence_score": confidence, "denial_reason": denial_reason,
    }))
    logger.info("Orchestrator complete | duration=%.2fs | confidence=%s", perf_counter() - run_start, confidence)


# ── HELPERS ───────────────────────────────────
def _classify_input(document_text: str, user_context: str) -> tuple:
    combined = (document_text + " " + user_context).lower()

    domain = "healthcare"
    if any(w in combined for w in ["visa", "immigration", "home office", "skilled worker", "uscis", "sponsorship", "certificate of sponsorship"]):
        domain = "legal_visa"
    elif any(w in combined for w in ["loan", "mortgage", "credit", "bank", "underwriting", "overdraft"]):
        domain = "finance"
    elif any(w in combined for w in ["grant", "funder", "foundation", "charity", "ngo", "subsidy"]):
        domain = "grants"
    elif any(w in combined for w in ["claim", "adjuster", "settlement", "damage claim"]) and \
         "prior auth" not in combined:
        domain = "insurance_claim"

    institution = ""
    for inst in ["bluecross", "blue cross", "aetna", "cigna", "humana", "unitedhealthcare",
                 "barclays", "lloyds", "hsbc", "natwest", "home office", "uscis",
                 "wellcome", "gates foundation"]:
        if inst in combined:
            institution = inst.title()
            break

    request_type = "general"
    if any(w in combined for w in ["adalimumab", "humira", "biologic", "dmard", "rheumat", "biologic"]):
        request_type = "biologics_rheumatology"
    elif "mri" in combined:
        request_type = "imaging_mri"
    elif "skilled worker" in combined or "tier 2" in combined:
        request_type = "uk_skilled_worker_visa"
    elif "business loan" in combined or "sme" in combined:
        request_type = "sme_business_loan"
    elif "grant" in combined:
        request_type = "general_ngo_grant"
    elif "insurance" in combined and "claim" in combined:
        request_type = "general_property_claim"

    denial_words = ["denied", "denial", "not approved", "does not meet", "rejected", "rejection", "credit balance is too low"]
    new_words = ["before i submit", "pre-check", "please check", "preparing", "planning to apply", "before i apply"]
    mode = "review_denial" if any(w in combined for w in denial_words) else "new_submission"
    if any(w in combined for w in new_words):
        mode = "new_submission"

    return domain, institution, request_type, mode


def _extract_denial_reason(text: str) -> str:
    lower = text.lower()
    for pattern in [r"reason for denial[:\s]+([^\n\.]+)", r"denied because[:\s]+([^\n\.]+)",
                    r"does not (meet|demonstrate)[:\s]+([^\n\.]+)", r"not approved[:\s]+([^\n\.]+)"]:
        m = re.search(pattern, lower)
        if m:
            groups = m.groups()
            return groups[-1].strip()[:300]
    idx = lower.find("denial")
    return text[max(0,idx):idx+250].strip() if idx >= 0 else "See full document"


def _calc_confidence(criteria: dict, audit: dict, draft: dict) -> int:
    s = audit.get("audit_summary", {})
    total = max(s.get("total_criteria", 1), 1)
    confirmed = s.get("confirmed", 0)
    blocking = s.get("blocking_gaps", 0)
    base = int((confirmed / total) * 100) if total else 70
    base -= blocking * 10
    draft_conf = draft.get("drafting_confidence", 80)
    return max(20, min(98, int((base + draft_conf) / 2)))
