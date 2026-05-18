# AuthAgent 🔑
### Autonomous Multi-Agent Approval Intelligence

> *"The information to approve your request already exists. It was there all along. AI finally connects it."*

Built for the **AI Agent Olympics Hackathon — Milan AI Week 2026**

---

## What It Does

AuthAgent is a multi-agent AI system that fights bureaucratic walls for people who need approvals — starting with healthcare prior authorization, built for every domain where a human is waiting on an institution to say yes.

**Two modes:**
- **Review a denial** → reads the denial letter, finds what's missing, drafts the appeal
- **New submission** → retrieves criteria, audits your documents, builds a complete submission

**Five domains:** Healthcare · Legal/Visa · Finance · Grants · Insurance Claims

---

## Architecture

```
INPUT (text / image / PDF)
        │
        ▼
VisionPreprocessor (Claude Vision OCR)
        │
        ▼
OrchestratorAgent  ──── plans ReAct loop, classifies domain/mode
        │
        ├──► MoE Router  ──── loads domain knowledge base
        │
        ├──► CriteriaAgent  ──── extracts exact criteria checklist
        │
        ├──► AuditAgent  ──── cross-references evidence vs criteria
        │
        └──► DraftingAgent  ──── writes the letter that gets the yes
                │
                ▼
        OUTPUT (streamed ReAct trace + draft + gap report)
```

### MoE (Mixture of Experts) Pattern
Same Claude engine across all agents — domain knowledge injected via system prompt + criteria JSON per case. One reasoning mind, right textbook loaded per domain.

### ReAct Loop
Every agent step streams live to the UI:
`THOUGHT → ACTION → OBSERVATION → THOUGHT → ... → SYNTHESIS`

---

## Stack

| Layer | Technology |
|---|---|
| AI Engine | Anthropic Claude Sonnet 4 (all agents + vision) |
| Backend | Python 3.11 + FastAPI + async SSE streaming |
| Criteria DB | JSON (5 domains, upgradeable to vector DB) |
| Frontend | Next.js + Tailwind CSS |
| Deployment | Railway (backend) + Vercel (frontend) |

---

## Quick Start

### 1. Clone & install
```bash
git clone https://github.com/YOUR_USERNAME/authagent
cd authagent
pip install -r requirements.txt
```

### 2. Set API key
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Run locally
```bash
uvicorn api.main:app --reload --port 8000
```

### 4. Test it
```bash
# Health check
curl http://localhost:8000/health

# Run a demo scenario
curl http://localhost:8000/demo/cancer_denial

# Run text input
curl -X POST http://localhost:8000/run/text \
  -H "Content-Type: application/json" \
  -d '{"document_text": "DENIAL: Patient does not meet step therapy requirements...", "mode": "auto"}'
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/domains` | List supported domains |
| POST | `/run/text` | Run agents on text input (SSE) |
| POST | `/run/file` | Run agents on uploaded file — PDF/image (SSE) |
| POST | `/ocr` | OCR only — extract text from file |
| GET | `/demo/{scenario}` | Run pre-loaded demo scenario (SSE) |

### Demo scenarios
- `/demo/cancer_denial` — Prior auth denial appeal (healthcare)
- `/demo/visa_new` — UK Skilled Worker Visa check (legal)
- `/demo/loan_new` — SME business loan application (finance)

---

## Deploy to Railway (Backend)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variable
railway variables set ANTHROPIC_API_KEY=your_key_here
```

---

## Project Structure

```
authagent/
├── api/
│   └── main.py          # FastAPI app, all endpoints, SSE streaming
├── agents/
│   ├── prompts.py       # All 4 agent system prompts
│   └── engine.py        # Orchestrator ReAct loop, all agent calls
├── tools/
│   └── criteria_loader.py  # MoE router — domain knowledge loader
├── criteria_db/
│   └── criteria.json    # 5-domain criteria knowledge base
├── requirements.txt
├── Procfile             # Railway deployment
├── railway.json         # Railway config
└── .env.example
```

---

## The 4 Agents

### OrchestratorAgent
The brain. Classifies domain, plans the ReAct sequence, dispatches specialist agents, monitors outputs, handles failures, synthesises final result. Never drafts or audits directly.

### CriteriaAgent
Knows what every institution needs. Loads the right domain knowledge base (MoE), extracts the exact criteria checklist, specifies what counts as sufficient evidence for each criterion.

### AuditAgent
The forensic analyst. Cross-references every criterion against available documents. Returns confirmed/partial/missing with exact citations. Never softens a gap — accuracy saves lives.

### DraftingAgent
Writes the letter that gets the yes. Criteria-mapped, evidence-cited, institution-language-matched. Always flags what the human must add before sending.

---

## Hackathon

**Event:** AI Agent Olympics — Milan AI Week 2026
**Track:** Agentic Workflows + Collaborative Systems
**Prize pool:** $32,000+

---

*Human review required before submitting any output. AuthAgent is a decision-support tool — the human is always in the loop.*
