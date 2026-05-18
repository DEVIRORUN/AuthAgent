"""
AuthAgent — Criteria Loader (MoE Router)
Loads the right domain knowledge base for each case.
"""

import json
import os

_CRITERIA_PATH = os.path.join(os.path.dirname(__file__), "../criteria_db/criteria.json")

_criteria_cache = None


def _load_all():
    global _criteria_cache
    if _criteria_cache is None:
        with open(_CRITERIA_PATH, "r") as f:
            _criteria_cache = json.load(f)
    return _criteria_cache


def load_criteria(domain: str, request_type: str) -> dict:
    """
    MoE Router: given domain + request_type,
    loads the exact knowledge base for this case.
    Falls back gracefully through specificity levels.
    """
    db = _load_all()

    domain_db = db.get(domain, {})
    if not domain_db:
        return {"note": f"No specific criteria found for domain: {domain}. Using general reasoning."}

    # Try exact request_type match
    if request_type in domain_db:
        return domain_db[request_type]

    # Try partial match
    for key in domain_db:
        if request_type in key or key in request_type:
            return domain_db[key]

    # Try sub-key match (e.g. prior_authorization -> biologics_rheumatology)
    for key, val in domain_db.items():
        if isinstance(val, dict):
            for sub_key, sub_val in val.items():
                if isinstance(sub_val, dict) and "criteria" in sub_val:
                    if request_type in sub_key or sub_key in request_type:
                        return sub_val

    # Return first leaf with "criteria" key as fallback
    for key, val in domain_db.items():
        if isinstance(val, dict):
            for sub_key, sub_val in val.items():
                if isinstance(sub_val, dict) and "criteria" in sub_val:
                    return sub_val
            if "criteria" in val:
                return val

    return {"note": f"No criteria found for {domain}/{request_type}"}


def classify_domain(text: str) -> str:
    """Quick domain classification from text."""
    t = text.lower()
    if any(w in t for w in ["visa", "immigration", "home office", "sponsor", "skilled worker"]):
        return "legal_visa"
    if any(w in t for w in ["loan", "mortgage", "credit", "bank", "finance", "underwriting"]):
        return "finance"
    if any(w in t for w in ["grant", "funder", "ngo", "charity", "foundation"]):
        return "grants"
    if any(w in t for w in ["insurance claim", "adjuster", "settlement", "damage claim"]):
        return "insurance_claim"
    return "healthcare"


def list_domains() -> list:
    """List all available domains."""
    return list(_load_all().keys())


def list_request_types(domain: str) -> list:
    """List all request types for a domain."""
    db = _load_all()
    domain_db = db.get(domain, {})
    types = []
    for key, val in domain_db.items():
        if isinstance(val, dict) and "criteria" in val:
            types.append(key)
        elif isinstance(val, dict):
            for sub_key in val:
                types.append(f"{key}/{sub_key}")
    return types
