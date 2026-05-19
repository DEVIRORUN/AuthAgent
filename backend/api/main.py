"""
AuthAgent API — Gemini-powered FastAPI backend
"""

import json
import asyncio
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.engine import run_orchestrator, run_vision_ocr
from tools.runtime_logger import get_logger, log_event

app = FastAPI(title="AuthAgent API", version="1.0.0")
logger = get_logger("authagent.api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextRequest(BaseModel):
    document_text: str
    user_context: Optional[str] = ""
    mode: Optional[str] = "auto"


async def event_stream(generator):
    try:
        async for event in generator:
            log_event(event)
            yield f"data: {json.dumps(event)}\n\n"
            await asyncio.sleep(0)
    except Exception as e:
        logger.exception("Streaming pipeline failed")
        error_event = {'type':'error','agent':'system','title':'Error','content':str(e)}
        log_event(error_event)
        yield f"data: {json.dumps(error_event)}\n\n"
    finally:
        logger.info("SSE stream complete")
        yield 'data: {"type":"done"}\n\n'


@app.get("/")
async def root():
    logger.info("Health metadata requested")
    return {"name": "AuthAgent", "version": "1.0.0", "model": "gemini-2.0-flash + gemini-1.5-pro", "status": "operational"}


@app.get("/health")
async def health():
    logger.info("Health check OK")
    return {"status": "healthy", "engine": "gemini"}


@app.post("/run/text")
async def run_text(request: TextRequest):
    if not request.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text required")
    logger.info(
        "Text run requested | mode=%s | document_chars=%s | context_chars=%s",
        request.mode or "auto",
        len(request.document_text),
        len(request.user_context or ""),
    )
    generator = run_orchestrator(request.document_text, request.user_context or "", request.mode or "auto")
    return StreamingResponse(event_stream(generator), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


@app.post("/run/file")
async def run_file(file: UploadFile = File(...), user_context: str = Form(default=""), mode: str = Form(default="auto")):
    allowed = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported: {file.content_type}")
    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 20MB")
    logger.info(
        "File run requested | filename=%s | content_type=%s | size_kb=%.1f | mode=%s",
        file.filename,
        file.content_type,
        len(file_bytes) / 1024,
        mode,
    )

    async def pipeline():
        yield {"type": "action", "agent": "VisionPreprocessor", "title": f"Reading {file.filename}",
               "content": f"File: {file.filename} ({len(file_bytes)/1024:.1f}KB). Running Gemini Vision OCR..."}
        try:
            ocr = run_vision_ocr(file_bytes, file.content_type)
            text = ocr.get("extracted_text", "")
            meta = ocr.get("key_metadata", {})
            yield {"type": "observation", "agent": "VisionPreprocessor", "title": f"Extracted — {ocr.get('extraction_confidence','N/A')}% confidence",
                   "content": f"Doc type: {ocr.get('document_type','unknown')} | Institution: {meta.get('institution','N/A')} | Date: {meta.get('date','N/A')} | Ref: {meta.get('reference_number','N/A')} | {len(text)} chars extracted."}
            if not text:
                yield {"type": "error", "agent": "VisionPreprocessor", "title": "Extraction failed", "content": "Could not extract text. Try a clearer image."}
                return
        except Exception as e:
            yield {"type": "error", "agent": "VisionPreprocessor", "title": "OCR error", "content": str(e)}
            return
        async for event in run_orchestrator(text, user_context, mode):
            yield event

    return StreamingResponse(event_stream(pipeline()), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# Demo scenarios
DEMOS = {
    "cancer_denial": {
        "document_text": """PRIOR AUTHORIZATION DENIAL NOTICE
Patient: Sarah Mitchell — Member ID: BCX-449201
Procedure: Adalimumab (Humira) 40mg — ICD-10 M05.79 Rheumatoid Arthritis
REASON FOR DENIAL: Clinical documentation does not demonstrate adequate trial and failure of two conventional DMARDs including methotrexate. Per BlueCross Clinical Policy Bulletin 0600, step therapy must be documented.
Appeal deadline: March 16, 2025

Clinical notes Dr. Anderson Jan 2025: Methotrexate 15mg weekly since Oct 2023 (14 months). Persistent joint inflammation. DAS28 4.8. Hydroxychloroquine added Feb 2024, discontinued Aug 2024 inadequate response.
Labs: TB IGRA negative Nov 2024. Hep B negative Dec 2023.""",
        "mode": "review_denial"
    },
    "visa_new": {
        "document_text": """UK Skilled Worker Visa — Amara Diallo (Senegalese)
Job: Software Engineer, TechCorp Ltd London, £72,000/yr
CoS: COS-2025-TC-447821 issued March 1 2025
Docs: Passport (exp Dec 2028), CS degree French university, IELTS Academic 7.5 (Jan 2024), £2,500 bank balance over 28 days, sponsor letter.""",
        "mode": "new_submission"
    },
    "loan_new": {
        "document_text": """SME Loan — Mama's Kitchen Ltd, £85,000
Restaurant 3 years trading, revenue £420k (2024), £380k (2023), profit £52k
Docs: 2022+2023 accounts, 6mo bank statements, business plan, lease agreement.
Missing: unsure — accountant flagged potential gaps.""",
        "mode": "new_submission"
    }
}


@app.get("/demo/{scenario}")
async def run_demo(scenario: str):
    if scenario not in DEMOS:
        raise HTTPException(status_code=404, detail=f"Available: {list(DEMOS.keys())}")
    logger.info("Demo run requested | scenario=%s", scenario)
    d = DEMOS[scenario]
    generator = run_orchestrator(d["document_text"], "", d["mode"])
    return StreamingResponse(event_stream(generator), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
