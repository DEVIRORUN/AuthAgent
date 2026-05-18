"""
AuthAgent — FastAPI Backend
Multi-agent approval intelligence system.
"""

import json
import asyncio
import base64
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.engine import run_orchestrator, run_vision_ocr
from tools.criteria_loader import list_domains, list_request_types

app = FastAPI(
    title="AuthAgent API",
    description="Autonomous multi-agent approval intelligence system",
    version="1.0.0",
)

# Allow all origins for hackathon demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────
class TextRequest(BaseModel):
    document_text: str
    user_context: Optional[str] = ""
    mode: Optional[str] = "auto"  # auto | review_denial | new_submission


# ─────────────────────────────────────────────
# SSE STREAMING HELPER
# ─────────────────────────────────────────────
async def event_stream(generator):
    """
    Wraps async generator into SSE format.
    Each event: data: {json}\n\n
    """
    try:
        async for event in generator:
            payload = json.dumps(event)
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0)  # yield control for true streaming
    except Exception as e:
        error_event = {
            "type": "error",
            "agent": "system",
            "title": "Stream error",
            "content": str(e),
        }
        yield f"data: {json.dumps(error_event)}\n\n"
    finally:
        yield "data: {\"type\": \"done\"}\n\n"


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "AuthAgent",
        "version": "1.0.0",
        "status": "operational",
        "description": "Autonomous multi-agent approval intelligence",
        "endpoints": ["/run/text", "/run/file", "/ocr", "/domains", "/health"],
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "agents": ["orchestrator", "criteria", "audit", "drafting", "vision"]}


@app.get("/domains")
async def get_domains():
    """List all supported domains and request types."""
    domains = list_domains()
    return {
        "domains": {d: list_request_types(d) for d in domains}
    }


@app.post("/run/text")
async def run_text(request: TextRequest):
    """
    Run the full multi-agent pipeline on plain text input.
    Streams ReAct events via SSE.
    """
    if not request.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text is required")

    generator = run_orchestrator(
        document_text=request.document_text,
        user_context=request.user_context or "",
        mode=request.mode or "auto",
    )

    return StreamingResponse(
        event_stream(generator),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/run/file")
async def run_file(
    file: UploadFile = File(...),
    user_context: str = Form(default=""),
    mode: str = Form(default="auto"),
):
    """
    Run the full multi-agent pipeline on an uploaded file.
    Supports: PDF, JPEG, PNG, WEBP, GIF.
    Step 1: Vision OCR extracts text.
    Step 2: Full agent pipeline runs on extracted text.
    Streams ReAct events via SSE.
    """
    # Validate file type
    allowed_types = {
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
    }
    content_type = file.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Supported: PDF, JPEG, PNG, WEBP, GIF",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum 20MB.")

    async def file_pipeline():
        # ── Event 0: Vision OCR ──────────────────
        yield {
            "type": "action",
            "agent": "VisionPreprocessor",
            "title": f"Reading {file.filename}",
            "content": f"File received: {file.filename} ({len(file_bytes) / 1024:.1f}KB, {content_type}). Passing to Claude Vision for OCR extraction. Converting all text, metadata, dates, reference numbers from the document.",
        }

        try:
            ocr_result = run_vision_ocr(file_bytes, content_type)
            extracted_text = ocr_result.get("extracted_text", "")
            doc_type = ocr_result.get("document_type", "unknown")
            metadata = ocr_result.get("key_metadata", {})
            ocr_confidence = ocr_result.get("extraction_confidence", "N/A")

            yield {
                "type": "observation",
                "agent": "VisionPreprocessor",
                "title": f"Extracted: {doc_type} — {ocr_confidence}% confidence",
                "content": f"Document type: {doc_type} | Extraction confidence: {ocr_confidence}% | Institution: {metadata.get('institution', 'N/A')} | Date: {metadata.get('date', 'N/A')} | Reference: {metadata.get('reference_number', 'N/A')} | Deadlines found: {metadata.get('deadlines', [])}. Text extracted: {len(extracted_text)} characters.",
            }

            if not extracted_text:
                yield {
                    "type": "error",
                    "agent": "VisionPreprocessor",
                    "title": "Extraction failed",
                    "content": "Could not extract text from document. Please ensure the image is clear and not heavily compressed.",
                }
                return

        except Exception as e:
            yield {
                "type": "error",
                "agent": "VisionPreprocessor",
                "title": "OCR error",
                "content": f"Vision preprocessing failed: {str(e)}. Try uploading a clearer image or PDF.",
            }
            return

        # ── Continue with agent pipeline ─────────
        full_context = f"[Document: {file.filename}]\n{extracted_text}\n\n[User context]: {user_context}"

        async for event in run_orchestrator(
            document_text=extracted_text,
            user_context=user_context,
            mode=mode,
        ):
            yield event

    return StreamingResponse(
        event_stream(file_pipeline()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/ocr")
async def ocr_only(file: UploadFile = File(...)):
    """
    OCR endpoint only — extract text from image/PDF without running agents.
    Useful for testing Vision preprocessing.
    """
    file_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    result = run_vision_ocr(file_bytes, content_type)
    return result


# ─────────────────────────────────────────────
# DEMO SCENARIOS (for hackathon demo)
# ─────────────────────────────────────────────
DEMO_SCENARIOS = {
    "cancer_denial": {
        "document_text": """PRIOR AUTHORIZATION DENIAL NOTICE

Patient: Sarah Mitchell, DOB 03/14/1971
Member ID: BCX-449201
Date of denial: March 2, 2025
Procedure: Adalimumab (Humira) 40mg injection, CPT J0135
Diagnosis: Rheumatoid Arthritis, ICD-10 M05.79

REASON FOR DENIAL:
Clinical documentation does not demonstrate that the patient has had an adequate trial and failure of at least two conventional DMARDs, including methotrexate, prior to initiating biologic therapy. Per BlueCross Clinical Policy Bulletin 0600, step therapy requirements must be documented in the medical record before biologics will be approved.

Appeal deadline: March 16, 2025 (14 days from denial date)

Clinical notes from Dr. Anderson dated January 2025:
Patient has been on methotrexate 15mg weekly since October 2023 (14 months). Patient reports persistent joint inflammation in bilateral wrists and MCP joints despite dose escalation. DAS28 score 4.8 (moderate-severe disease). Hydroxychloroquine 400mg added February 2024, discontinued August 2024 due to inadequate response. Recommend escalation to biologic therapy.

Lab results on file: Negative TB IGRA test dated November 2024. Hep B surface antigen negative December 2023.""",
        "user_context": "This is an urgent appeal for my patient Sarah who needs biologic therapy. She has been on methotrexate for over a year with documented failure. I need to appeal this denial.",
        "mode": "review_denial",
    },
    "visa_new": {
        "document_text": """Visa application documents — Amara Diallo

I am applying for a UK Skilled Worker Visa.

Job offer: Software Engineer at TechCorp Ltd, London
Salary: £72,000 per year
Start date: June 1, 2025
Certificate of Sponsorship: issued March 1, 2025, reference COS-2025-TC-447821
Sponsor licence: TechCorp Ltd, confirmed licensed

Documents I have:
- Passport: Senegalese passport, expires December 2028
- University degree: Computer Science BSc, Université Cheikh Anta Diop (taught in French)
- IELTS Academic certificate: Score 7.5 overall (L8.0, R7.5, W7.0, S7.5), taken January 2024
- Bank statements: showing £2,500 balance over last 28 days (January 10 - February 7, 2025)
- Employer sponsor letter confirming role and salary

I am from Senegal.""",
        "user_context": "I want to check all my documents before submitting my visa application. Please identify any gaps.",
        "mode": "new_submission",
    },
    "loan_new": {
        "document_text": """SME Loan Application — Mama's Kitchen Ltd

Business: Mama's Kitchen Ltd
Loan requested: £85,000 for kitchen expansion
Business type: Nigerian/Lagos-inspired restaurant, London
Registered: Companies House, number 12847392
Trading since: March 2022 (3 years)

Financial information:
- Annual revenue 2024: £420,000
- Annual revenue 2023: £380,000
- Net profit 2024: £52,000

Documents available:
- 2022 and 2023 filed accounts (Companies House)
- 6 months bank statements (July 2024 - December 2024)
- Business plan with 3-year projections
- Lease agreement for current premises (expires 2029)

Director: Fatima Okafor
Purpose of loan: New commercial kitchen equipment and ventilation system""",
        "user_context": "My accountant said I might be missing something. Please check what Barclays requires and tell me exactly what gaps I have.",
        "mode": "new_submission",
    },
}


@app.get("/demo/{scenario}")
async def run_demo(scenario: str):
    """Run a pre-loaded demo scenario. Streams SSE."""
    if scenario not in DEMO_SCENARIOS:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario}' not found. Available: {list(DEMO_SCENARIOS.keys())}",
        )

    s = DEMO_SCENARIOS[scenario]
    generator = run_orchestrator(
        document_text=s["document_text"],
        user_context=s["user_context"],
        mode=s["mode"],
    )

    return StreamingResponse(
        event_stream(generator),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
