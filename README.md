# AuthAgent 🔑
### Autonomous Multi-Agent Approval Intelligence

> *"The information to approve your request already exists. AI finally connects it."*

**AI Agent Olympics Hackathon — Milan AI Week 2026 | $32,000+ prize pool**

---

## Quick Start (Local)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Copy and fill in your API key
cp .env.example .env
# Add: GEMINI_API_KEY=your_key_from_aistudio.google.com

# Run
uvicorn api.main:app --reload --port 8000
```

Test: http://localhost:8000/health

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:3000

---

## Get Gemini API Key (Free)

1. Go to **aistudio.google.com**
2. Click "Get API key"
3. Create key — free, no card needed
4. Paste into `backend/.env`

---

## Deploy

### Backend → Railway
```bash
cd backend
railway login
railway init
railway up
railway variables set GEMINI_API_KEY=your_key
```

### Frontend → Vercel
```bash
cd frontend
vercel
# Set env: NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

---

## Architecture

```
User uploads image/PDF/text
        │
        ▼
VisionPreprocessor (Gemini Vision OCR)
        │
        ▼
OrchestratorAgent ── classifies domain, plans ReAct loop
        │
        ├──► MoE Router ── loads domain knowledge base
        ├──► CriteriaAgent ── extracts exact criteria checklist
        ├──► AuditAgent ── confirmed / partial / missing per criterion
        └──► DraftingAgent ── writes the letter that gets the yes
                │
                ▼
        Live ReAct trace + audit report + drafted letter
```

## Domains Supported
- Healthcare (prior authorization, biologic appeals)
- Legal / Visa (UK Skilled Worker, immigration)
- Finance (SME loans, business credit)
- Grants (NGO, research, public health)
- Insurance Claims (property, contents)

---

## Project Structure

```
authagent/
├── backend/
│   ├── agents/
│   │   ├── prompts.py      # All 5 system prompts
│   │   └── engine.py       # Gemini-powered agent orchestration
│   ├── tools/
│   │   └── criteria_loader.py  # MoE domain router
│   ├── criteria_db/
│   │   └── criteria.json   # 5-domain knowledge base
│   ├── api/
│   │   └── main.py         # FastAPI + SSE streaming
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx     # Main application
    │   │   ├── layout.tsx
    │   │   └── globals.css
    │   ├── components/
    │   │   ├── Sidebar.tsx
    │   │   ├── ReActBlock.tsx
    │   │   ├── OutputCard.tsx
    │   │   └── TypingIndicator.tsx
    │   └── lib/
    │       ├── types.ts
    │       ├── scenarios.ts
    │       └── utils.ts
    ├── package.json
    ├── tailwind.config.ts
    └── vercel.json
```
