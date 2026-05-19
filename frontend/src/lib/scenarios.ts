import { Scenario } from "./types";

export const SCENARIOS: Scenario[] = [
  {
    key: "cancer",
    label: "Cancer biologic denied — appeal",
    domain: "healthcare",
    mode: "review_denial",
    dotColor: "#E05C5C",
    text: `PRIOR AUTHORIZATION DENIAL NOTICE

Patient: Sarah Mitchell, DOB 03/14/1971
Member ID: BCX-449201 | Date of denial: March 2, 2025
Procedure: Adalimumab (Humira) 40mg injection — ICD-10 M05.79

REASON FOR DENIAL:
Clinical documentation does not demonstrate adequate trial and failure of at least two conventional DMARDs, including methotrexate. Per BlueCross Clinical Policy Bulletin 0600, step therapy requirements must be documented before biologics will be approved.

Appeal deadline: March 16, 2025 (14 days)

Clinical notes Dr. Anderson (Jan 2025): Patient on methotrexate 15mg weekly since Oct 2023 (14 months). Persistent bilateral wrist/MCP joint inflammation. DAS28 score 4.8 (moderate-severe). Hydroxychloroquine added Feb 2024, discontinued Aug 2024 — inadequate response. Escalation to biologic recommended.

Labs: TB IGRA negative (Nov 2024). Hep B surface antigen negative (Dec 2023).`,
  },
  {
    key: "visa",
    label: "UK Skilled Worker Visa — gap check",
    domain: "legal_visa",
    mode: "new_submission",
    dotColor: "#E8A74A",
    text: `UK Skilled Worker Visa Application — Pre-submission Check

Applicant: Amara Diallo (Senegalese national)
Role: Software Engineer, TechCorp Ltd, London — £72,000/year
Certificate of Sponsorship: COS-2025-TC-447821 (issued March 1, 2025)

Documents I have:
- Passport: valid to December 2028
- University degree: Computer Science BSc (taught in French — Université Cheikh Anta Diop, Senegal)
- IELTS Academic certificate: 7.5 overall (taken January 2024)
- Bank statements: £2,500 balance over 28 days (Jan 10 – Feb 7, 2025)
- Sponsor confirmation letter from TechCorp

I am from Senegal. Please identify any gaps before I submit.`,
  },
  {
    key: "loan",
    label: "SME restaurant loan — missing docs",
    domain: "finance",
    mode: "new_submission",
    dotColor: "#5CB87A",
    text: `SME Business Loan Application — Pre-check

Business: Mama's Kitchen Ltd (Lagos-inspired restaurant, London)
Loan: £85,000 for kitchen expansion
Companies House: 12847392 | Trading: 3 years

Financials:
- Revenue 2024: £420,000 | 2023: £380,000 | Net profit 2024: £52,000

Documents available:
- 2022 and 2023 filed accounts (Companies House)
- 6 months bank statements (July–December 2024)
- Business plan with 3-year projections
- Lease agreement (expires 2029)

Director: Fatima Okafor
My accountant said I might be missing something — please check what gaps I have before applying.`,
  },
  {
    key: "grant",
    label: "NGO health grant — criteria check",
    domain: "grants",
    mode: "new_submission",
    dotColor: "#A99EE8",
    text: `Grant Application Pre-Check — HealthBridge CIC

Organisation: HealthBridge CIC (registered community interest company, UK)
Funder: Wellcome Trust — Public Health Innovation Fund
Amount: £120,000 over 18 months

Project: Mobile health screening clinics for rural communities. Targeting early detection of hypertension and diabetes. Partnered with 4 district hospitals in East Africa. Projected reach: 15,000 patients in year 1.

Documents available:
- CIC registration certificate
- 2-year audited accounts
- Project proposal (narrative, 8 pages)
- Letters of support from partner hospitals
- Budget breakdown (line items)

Please check against Wellcome Trust grant criteria and flag any gaps.`,
  },
];
