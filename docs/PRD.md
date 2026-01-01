# CloudGPUs.io - Product Requirements Document

**Version**: 1.0
**Date**: December 30, 2025
**Author**: Product Manager
**Status**: Draft for Review

---

## Executive Summary

CloudGPUs.io is a GPU cloud pricing aggregation platform that enables AI/ML developers and researchers to find the best GPU rental deals across 40+ providers. The platform leverages programmatic SEO (pSEO) to generate 3000+ landing pages, driving organic traffic while monetizing through affiliate partnerships with GPU cloud providers.

**Core Value Proposition**: Real-time, accurate GPU cloud pricing comparison with provider reliability insights, saving users hours of research and potentially thousands of dollars per month.

---

## 1. User Personas

### Persona 1: The Indie AI Developer ("Dev Dave")

| Attribute           | Details                                                    |
| ------------------- | ---------------------------------------------------------- |
| **Role**            | Solo AI developer / indie hacker                           |
| **Budget**          | $100-500/month                                             |
| **Use Case**        | Fine-tuning 7B-30B models, Stable Diffusion, side projects |
| **Technical Level** | High (can SSH, Docker, Python)                             |
| **GPU Preference**  | RTX 4090/5090, A100, cheap H100                            |

**Pain Points**:

- Wastes 2-3 hours weekly comparing prices across RunPod, Vast.ai, Lambda
- Gets burned by unreliable DePIN nodes that drop mid-training
- Doesn't know which providers have spot/preemptible pricing
- Fears hidden costs (egress, storage, network)

**Goals**:

- Find the cheapest reliable GPU for the specific task
- Avoid vendor lock-in
- Minimize time spent on infrastructure research

**Quote**: "I just want to know where I can get an H100 for under $2/hour that won't crash during my 8-hour training run."

---

### Persona 2: The ML Platform Lead ("Platform Priya")

| Attribute           | Details                                                         |
| ------------------- | --------------------------------------------------------------- |
| **Role**            | ML Platform Engineer at Series B startup                        |
| **Budget**          | $5,000-50,000/month                                             |
| **Use Case**        | Production inference, distributed training, team GPU allocation |
| **Technical Level** | Expert (K8s, Terraform, multi-cloud)                            |
| **GPU Preference**  | H100 SXM, H200, B200 clusters                                   |

**Pain Points**:

- Needs to justify cloud spend to CFO with cost comparisons
- Managing GPU allocation across multiple cloud providers
- Evaluating new providers without wasting procurement cycles
- InfiniBand vs Ethernet decisions for distributed training

**Goals**:

- Build a defensible multi-cloud GPU strategy
- Reduce cost per training run by 30%+
- Maintain SLA guarantees for production inference

**Quote**: "I need a single source of truth for GPU pricing that I can share with my CFO and engineering leads."

---

### Persona 3: The Research Scientist ("Researcher Raj")

| Attribute           | Details                                                             |
| ------------------- | ------------------------------------------------------------------- |
| **Role**            | PhD student / Research scientist at university lab                  |
| **Budget**          | Grant-funded, $2,000-10,000 per project                             |
| **Use Case**        | Training custom architectures, ablation studies, paper reproduction |
| **Technical Level** | Moderate (Python expert, limited DevOps)                            |
| **GPU Preference**  | A100, H100 (grant often specifies NVIDIA)                           |

**Pain Points**:

- Grant money must stretch as far as possible
- Academic credits often restricted to AWS/GCP (overpriced)
- Needs to report exact costs for grant compliance
- Unfamiliar with the ecosystem of specialized AI clouds

**Goals**:

- Maximize GPU hours per dollar of grant funding
- Find providers that accept academic billing
- Document cost savings for grant renewals

**Quote**: "My advisor expects me to train a model comparable to GPT-2 with $3,000. I need to find the cheapest H100s that accept purchase orders."

---

### Persona 4: The AI Agency Founder ("Agency Alex")

| Attribute           | Details                                        |
| ------------------- | ---------------------------------------------- |
| **Role**            | Founder of AI consulting/implementation agency |
| **Budget**          | Variable per client ($500-20,000/project)      |
| **Use Case**        | Client demos, PoCs, short-term training bursts |
| **Technical Level** | High (full-stack, infrastructure-aware)        |
| **GPU Preference**  | Whatever is fastest to provision + cheapest    |

**Pain Points**:

- Every client project has different GPU requirements
- Needs to spin up/down GPUs within hours, not days
- Must invoice clients accurately for GPU costs
- Can't afford to waste billable hours on provider research

**Goals**:

- Instant answers: "Best GPU for X task under Y budget"
- Quick provider onboarding (no enterprise sales cycles)
- Pass-through billing transparency for clients

**Quote**: "I have a client demo tomorrow. I need a B200 for 4 hours, and I need to know my options in 5 minutes."

---

## 2. User Stories

### Epic 1: Price Discovery & Comparison

**Goal**: Users can quickly find and compare GPU prices across all providers

| ID       | Feature                | User Story                                                                                            | Priority |
| -------- | ---------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| E1-F1    | GPU Search             | As Dev Dave, I want to search for a specific GPU model so that I can see all providers offering it    | P0       |
| E1-F1-S1 |                        | I want to filter by GPU model (H100, H200, RTX 5090, etc.)                                            | P0       |
| E1-F1-S2 |                        | I want to see on-demand, spot, and reserved pricing side-by-side                                      | P0       |
| E1-F1-S3 |                        | I want to filter by minimum VRAM (e.g., 80GB+)                                                        | P1       |
| E1-F2    | Price Comparison Table | As Platform Priya, I want a sortable comparison table so that I can evaluate providers systematically | P0       |
| E1-F2-S1 |                        | I want to sort by price (low to high)                                                                 | P0       |
| E1-F2-S2 |                        | I want to see price per GPU-hour AND price per node (8-GPU)                                           | P1       |
| E1-F2-S3 |                        | I want to export comparison data to CSV                                                               | P2       |
| E1-F3    | Provider Filtering     | As Researcher Raj, I want to filter by provider type so that I can exclude unreliable options         | P0       |
| E1-F3-S1 |                        | I want to filter: Specialized AI Cloud / Bare Metal / DePIN / Hyperscaler                             | P0       |
| E1-F3-S2 |                        | I want to see only "enterprise-grade" providers (exclude community nodes)                             | P1       |
| E1-F3-S3 |                        | I want to filter by region (US, EU, APAC)                                                             | P1       |

---

### Epic 2: Provider Intelligence

**Goal**: Users can assess provider quality beyond just price

| ID       | Feature                | User Story                                                                                            | Priority |
| -------- | ---------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| E2-F1    | Provider Profiles      | As Agency Alex, I want detailed provider profiles so that I can make informed decisions               | P0       |
| E2-F1-S1 |                        | I want to see provider description, founding date, notable customers                                  | P1       |
| E2-F1-S2 |                        | I want to see supported payment methods (credit card, crypto, invoice)                                | P1       |
| E2-F1-S3 |                        | I want to see API documentation links                                                                 | P0       |
| E2-F2    | Reliability Indicators | As Dev Dave, I want to know which DePIN providers are reliable so that I don't lose training progress | P0       |
| E2-F2-S1 |                        | I want to see a reliability score/badge for DePIN platforms                                           | P0       |
| E2-F2-S2 |                        | I want to see average uptime metrics (if available)                                                   | P2       |
| E2-F2-S3 |                        | I want warnings about provider limitations (e.g., "no SSH", "stateless only")                         | P1       |
| E2-F3    | Feature Comparison     | As Platform Priya, I want to compare provider features so that I can evaluate beyond price            | P1       |
| E2-F3-S1 |                        | I want to see: InfiniBand support, Kubernetes native, API type (REST/GraphQL/gRPC)                    | P1       |
| E2-F3-S2 |                        | I want to see networking specs (NVLink, inter-node bandwidth)                                         | P2       |

---

### Epic 3: pSEO Landing Pages

**Goal**: Generate thousands of SEO-optimized pages to capture organic traffic

| ID       | Feature          | User Story                                                                                   | Priority |
| -------- | ---------------- | -------------------------------------------------------------------------------------------- | -------- |
| E3-F1    | GPU Model Pages  | As a Google searcher, I want to find "H100 cloud pricing" and land on a comprehensive page   | P0       |
| E3-F1-S1 |                  | Page for each GPU: /gpu/h100, /gpu/h200, /gpu/b200, /gpu/rtx-5090                            | P0       |
| E3-F1-S2 |                  | Each page shows all providers, prices, specs, use cases                                      | P0       |
| E3-F1-S3 |                  | Dynamic pricing table updated daily                                                          | P0       |
| E3-F2    | Provider Pages   | As a Google searcher, I want to find "Lambda Labs pricing" and see comprehensive info        | P0       |
| E3-F2-S1 |                  | Page for each provider: /provider/lambda, /provider/runpod, etc.                             | P0       |
| E3-F2-S2 |                  | All GPU offerings, pricing history, features, reviews                                        | P1       |
| E3-F3    | Comparison Pages | As a Google searcher, I want to find "Lambda vs RunPod" and see a head-to-head comparison    | P1       |
| E3-F3-S1 |                  | Generate /compare/lambda-vs-runpod for all provider pairs                                    | P1       |
| E3-F3-S2 |                  | Side-by-side feature and pricing comparison                                                  | P1       |
| E3-F4    | Use Case Pages   | As a Google searcher, I want to find "best GPU for Stable Diffusion" and get recommendations | P1       |
| E3-F4-S1 |                  | Pages for common use cases: /use-case/stable-diffusion, /use-case/llm-training               | P1       |
| E3-F4-S2 |                  | GPU recommendations with price/performance analysis                                          | P2       |
| E3-F5    | Region Pages     | As a Google searcher, I want to find "GPU cloud Europe" and see EU-based options             | P2       |
| E3-F5-S1 |                  | Pages: /region/europe, /region/asia-pacific                                                  | P2       |

---

### Epic 4: Data Freshness & Accuracy

**Goal**: Maintain up-to-date, accurate pricing data

| ID       | Feature            | User Story                                                                                | Priority |
| -------- | ------------------ | ----------------------------------------------------------------------------------------- | -------- |
| E4-F1    | Automated Scraping | As the platform, I need to scrape pricing data daily so that users see current prices     | P0       |
| E4-F1-S1 |                    | Scrape all 40+ provider pricing pages via SOAX API                                        | P0       |
| E4-F1-S2 |                    | Parse and normalize pricing to common format                                              | P0       |
| E4-F1-S3 |                    | Handle API-based pricing (Lambda, RunPod have APIs)                                       | P0       |
| E4-F2    | Data Validation    | As Platform Priya, I want to trust the pricing data so that I can make business decisions | P0       |
| E4-F2-S1 |                    | Show "last updated" timestamp on all pricing                                              | P0       |
| E4-F2-S2 |                    | Flag stale data (>48 hours old)                                                           | P0       |
| E4-F2-S3 |                    | Anomaly detection for suspicious price changes                                            | P1       |
| E4-F3    | Price History      | As Researcher Raj, I want to see historical pricing so that I can time my purchases       | P2       |
| E4-F3-S1 |                    | Store 90 days of price history                                                            | P2       |
| E4-F3-S2 |                    | Show price trend charts on GPU/provider pages                                             | P2       |

---

### Epic 5: Monetization (Affiliate)

**Goal**: Generate revenue through affiliate partnerships

| ID       | Feature             | User Story                                                                       | Priority |
| -------- | ------------------- | -------------------------------------------------------------------------------- | -------- |
| E5-F1    | Affiliate Links     | As the business, I need to track affiliate clicks so that I can earn commissions | P0       |
| E5-F1-S1 |                     | All provider links use affiliate URLs where available                            | P0       |
| E5-F1-S2 |                     | Track click-through rates per provider                                           | P0       |
| E5-F1-S3 |                     | UTM parameter management for attribution                                         | P1       |
| E5-F2    | Conversion Tracking | As the business, I need to measure affiliate revenue so that I can optimize      | P1       |
| E5-F2-S1 |                     | Dashboard showing clicks, estimated conversions, revenue                         | P1       |
| E5-F2-S2 |                     | Integration with provider affiliate dashboards (where API available)             | P2       |

---

## 3. Functional Requirements

### P0 - Must Have (MVP)

| ID     | Requirement              | Description                          | Acceptance Criteria                                                                |
| ------ | ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------- |
| FR-001 | GPU Model Database       | Store and serve GPU specifications   | All current NVIDIA data center GPUs (B200, H200, H100, A100, L40S) + RTX 5090/4090 |
| FR-002 | Provider Database        | Store and serve provider information | 40+ providers with name, type, region, API docs, affiliate link                    |
| FR-003 | Pricing Database         | Store current and historical pricing | On-demand price per GPU-hour for each GPU/provider combination                     |
| FR-004 | Price Scraping Pipeline  | Automated daily price collection     | Scrape 40+ providers within 24-hour window, 95% success rate                       |
| FR-005 | GPU Search & Filter      | Search interface for GPU comparison  | Filter by GPU model, provider type, price range, region                            |
| FR-006 | Price Comparison Table   | Sortable, filterable comparison view | Sort by price, filter by criteria, show all relevant metadata                      |
| FR-007 | GPU Landing Pages        | pSEO pages for each GPU model        | 10+ GPU model pages with dynamic pricing, SEO metadata                             |
| FR-008 | Provider Landing Pages   | pSEO pages for each provider         | 40+ provider pages with all offerings, affiliate links                             |
| FR-009 | Affiliate Link Tracking  | Track outbound clicks                | Click logging with timestamp, user session, provider, GPU                          |
| FR-010 | Mobile-Responsive Design | Usable on mobile devices             | All pages render correctly on 375px+ screens                                       |

### P1 - Should Have (v1.1)

| ID     | Requirement               | Description                                   |
| ------ | ------------------------- | --------------------------------------------- |
| FR-011 | Comparison Pages          | Head-to-head provider comparison pages        |
| FR-012 | DePIN Reliability Scoring | Algorithm to rate DePIN provider reliability  |
| FR-013 | Spot/Reserved Pricing     | Display spot and reserved pricing options     |
| FR-014 | Region Filtering          | Filter providers by geographic region         |
| FR-015 | API Documentation Links   | Direct links to provider API docs             |
| FR-016 | Data Freshness Indicators | Show last-updated timestamps, flag stale data |
| FR-017 | Provider Feature Matrix   | Compare features (InfiniBand, K8s, API type)  |
| FR-018 | Email Alerts              | Subscribe to price drop notifications         |

### P2 - Nice to Have (Future)

| ID     | Requirement           | Description                           |
| ------ | --------------------- | ------------------------------------- |
| FR-019 | Price History Charts  | 90-day price trend visualization      |
| FR-020 | Use Case Pages        | Recommendation pages by workload type |
| FR-021 | Region-Specific Pages | Landing pages for EU, APAC markets    |
| FR-022 | CSV Export            | Export comparison data                |
| FR-023 | Cost Calculator       | Estimate total cost for training run  |
| FR-024 | Provider Reviews      | User-submitted reviews and ratings    |
| FR-025 | API Access            | Public API for pricing data           |

---

## 4. Non-Functional Requirements

### Performance

| Requirement                | Target                 | Measurement                 |
| -------------------------- | ---------------------- | --------------------------- |
| Page Load Time             | < 2 seconds (P75)      | Lighthouse, Core Web Vitals |
| Time to First Byte         | < 200ms                | Cloudflare Analytics        |
| API Response Time          | < 100ms (P95)          | Application metrics         |
| Scraping Pipeline Duration | < 4 hours for full run | Job monitoring              |
| Database Query Time        | < 50ms (P95)           | Query logging               |

### Reliability

| Requirement           | Target                       | Measurement         |
| --------------------- | ---------------------------- | ------------------- |
| Uptime                | 99.5% monthly                | Uptime monitoring   |
| Scraping Success Rate | 95% per provider             | Scraping job logs   |
| Data Freshness        | 95% of prices < 24 hours old | Data age monitoring |
| Error Rate            | < 0.1% of page loads         | Error tracking      |

### Scalability

| Requirement      | Target                    | Notes                                  |
| ---------------- | ------------------------- | -------------------------------------- |
| Concurrent Users | 1,000+                    | Cloudflare Pages handles static assets |
| Page Count       | 3,000+ programmatic pages | ISR/SSG on Cloudflare                  |
| Provider Count   | 100+ providers            | Database schema supports unlimited     |
| Price Records    | 1M+ historical records    | PostgreSQL with proper indexing        |

### Security

| Requirement              | Implementation                        |
| ------------------------ | ------------------------------------- |
| HTTPS Only               | Cloudflare SSL                        |
| Admin Authentication     | PayloadCMS built-in auth              |
| API Key Security         | Environment variables, never exposed  |
| SQL Injection Prevention | PayloadCMS ORM, parameterized queries |
| Rate Limiting            | Cloudflare WAF rules                  |

### SEO

| Requirement     | Target                             | Implementation                      |
| --------------- | ---------------------------------- | ----------------------------------- |
| Core Web Vitals | All "Good"                         | Static generation, optimized images |
| Crawl Budget    | 3000+ pages indexed within 30 days | XML sitemap, internal linking       |
| Meta Tags       | Dynamic per page                   | Next.js metadata API                |
| Structured Data | JSON-LD for products               | Schema.org Product markup           |

---

## 5. MVP Scope Definition

### v1.0 MVP (Launch)

**Timeline**: 6-8 weeks

**In Scope**:

1. **Data Layer**
   - GPU model database (10 models)
   - Provider database (40 providers)
   - Pricing database with daily updates
   - SOAX-based scraping pipeline for all providers

2. **Frontend**
   - Homepage with search and featured comparisons
   - GPU model landing pages (10 pages)
   - Provider landing pages (40 pages)
   - Comparison table with sorting and filtering
   - Mobile-responsive design

3. **Backend**
   - PayloadCMS admin for content management
   - BullMQ job queue for scraping
   - PostgreSQL on existing Supabase instance
   - Redis for caching and queue

4. **Monetization**
   - Affiliate links on all provider references
   - Click tracking analytics

5. **SEO**
   - XML sitemap
   - Meta tags and Open Graph
   - Semantic HTML structure

**Out of Scope for v1.0**:

- User accounts / authentication
- Price alerts / notifications
- Provider comparison pages (A vs B)
- Use case recommendation pages
- Price history charts
- API access for external developers
- Reviews and ratings
- Cost calculator tools
- Multi-language support

---

### v1.1 (Month 2-3)

**Features**:

- Provider comparison pages (Lambda vs RunPod, etc.)
- DePIN reliability scoring algorithm
- Spot and reserved pricing display
- Region filtering
- Data freshness indicators
- Email subscription for price alerts

---

### v2.0 (Month 4-6)

**Features**:

- Price history with 90-day charts
- Use case landing pages
- Cost calculator
- User reviews and ratings
- Public API (paid tier)

---

## 6. Success Metrics

### North Star Metric

**Affiliate Revenue per Month** - Primary business health indicator

### Launch KPIs (First 30 Days)

| Metric                  | Target          | Measurement           |
| ----------------------- | --------------- | --------------------- |
| Pages Indexed by Google | 500+            | Google Search Console |
| Organic Traffic         | 1,000+ sessions | Google Analytics      |
| Affiliate Clicks        | 200+            | Click tracking        |
| Bounce Rate             | < 60%           | Google Analytics      |
| Time on Site            | > 2 minutes     | Google Analytics      |
| Scraping Success Rate   | > 90%           | Job monitoring        |

### Growth KPIs (90 Days)

| Metric                      | Target                 | Measurement           |
| --------------------------- | ---------------------- | --------------------- |
| Pages Indexed               | 2,000+                 | Google Search Console |
| Organic Traffic             | 10,000+ sessions/month | Google Analytics      |
| Affiliate Clicks            | 1,000+/month           | Click tracking        |
| Estimated Affiliate Revenue | $500+/month            | Provider dashboards   |
| Returning Users             | > 20%                  | Google Analytics      |
| Email Subscribers           | 500+                   | Email platform        |

### Quality Metrics (Ongoing)

| Metric          | Target                    | Measurement        |
| --------------- | ------------------------- | ------------------ |
| Data Accuracy   | 95%+ prices correct       | Spot checks        |
| Data Freshness  | 95% prices < 24 hours old | Monitoring         |
| Core Web Vitals | All "Good"                | PageSpeed Insights |
| Uptime          | 99.5%+                    | Uptime monitoring  |

---

## 7. Risk Assessment

### Technical Risks

| Risk                                                                       | Probability | Impact | Mitigation                                                                                                                     |
| -------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Scraping Blocks** - Providers block our scrapers                         | High        | High   | Use SOAX rotating proxies; prioritize API-based providers; implement respectful rate limiting; maintain provider relationships |
| **Pricing Format Changes** - Providers change their pricing page structure | High        | Medium | Build flexible parsers with fallbacks; monitor for changes daily; alert on parse failures                                      |
| **Data Accuracy** - Incorrect prices damage trust                          | Medium      | High   | Cross-validate with APIs where available; show "last verified" dates; user reporting mechanism                                 |
| **Scraping Latency** - Pipeline takes too long                             | Medium      | Medium | Parallelize scraping; prioritize high-traffic providers; cache aggressively                                                    |
| **Supabase Limits** - Database capacity exceeded                           | Low         | Medium | Monitor usage; plan for dedicated instance if needed                                                                           |

### Business Risks

| Risk                                                           | Probability | Impact | Mitigation                                                                     |
| -------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------ |
| **Low Affiliate Conversion** - Users don't click through       | Medium      | High   | Optimize CTAs; A/B test button placement; provide genuine value to build trust |
| **Provider Consolidation** - Market shrinks to fewer providers | Low         | Medium | Diversify coverage; focus on emerging providers; add value-add content         |
| **Competitor Entry** - Well-funded competitor launches         | Medium      | Medium | Move fast; build SEO moat; establish provider relationships                    |
| **Affiliate Program Changes** - Providers cut affiliate rates  | Medium      | Medium | Diversify revenue (ads, sponsored listings); negotiate direct deals            |
| **SEO Algorithm Change** - Google devalues pSEO content        | Medium      | High   | Focus on genuine value and unique data; build email list as owned channel      |

### Operational Risks

| Risk                                                          | Probability | Impact | Mitigation                                                                       |
| ------------------------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------------- |
| **DePIN Data Quality** - DePIN platforms have unreliable data | High        | Medium | Implement reliability scoring; clearly label DePIN providers; add disclaimers    |
| **Legal/Terms Violation** - Scraping violates ToS             | Medium      | High   | Review provider ToS; prioritize API access; maintain transparency with providers |
| **Key Person Risk** - Solo developer bottleneck               | Medium      | Medium | Document thoroughly; use standard tech stack; automate operations                |

---

## 8. DePIN Platform Special Handling

DePIN (Decentralized Physical Infrastructure Networks) platforms require special treatment due to their unique characteristics:

### Platforms Identified

- Vast.ai (peer-to-peer GPU rental)
- io.net (distributed GPU network)
- Salad (consumer GPU nodes)
- Akash Network (decentralized cloud)

### Special Requirements

| Requirement                 | Rationale                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------- |
| **Reliability Badge**       | DePIN nodes have variable uptime; display reliability tier (High/Medium/Low)           |
| **Price Range Display**     | Prices vary significantly by individual node; show min-max range                       |
| **Host Rating Integration** | Where available, surface host-level ratings                                            |
| **Use Case Warnings**       | Flag limitations: "Best for: batch inference. Not recommended for: multi-day training" |
| **SLA Disclaimer**          | Clear disclaimer: "No SLA guaranteed. Host-dependent reliability."                     |

### Reliability Scoring Algorithm (P1)

**Factors**:

- Platform uptime history (public data)
- Average host rating (where available)
- Minimum hardware requirements enforced
- Refund/dispute policy
- Data center vs consumer hardware ratio

**Output**: Reliability tier (Enterprise / Prosumer / Community)

---

## 9. Content Strategy

### pSEO Page Templates

1. **GPU Model Page** (`/gpu/[model]`)
   - Hero: GPU specs, image, primary use cases
   - Pricing table: All providers, sortable
   - Content: Technical details, comparison to alternatives
   - CTA: Top 3 provider affiliate links

2. **Provider Page** (`/provider/[slug]`)
   - Hero: Provider logo, description, key stats
   - GPU offerings: All GPUs with pricing
   - Features: API, regions, payment methods
   - CTA: Primary affiliate link

3. **Comparison Page** (`/compare/[provider-a]-vs-[provider-b]`)
   - Side-by-side feature comparison
   - Pricing comparison by GPU
   - Pros/cons for each
   - CTA: Links to both providers

### Target Keywords (Sample)

| Page Type  | Example Keywords                                                      |
| ---------- | --------------------------------------------------------------------- |
| GPU Model  | "h100 cloud pricing", "rent h100 gpu", "h200 cost per hour"           |
| Provider   | "lambda labs pricing", "runpod vs vast.ai", "coreweave h100 cost"     |
| Comparison | "lambda vs runpod", "best gpu cloud provider", "cheapest h100 rental" |
| Use Case   | "best gpu for stable diffusion", "llm training gpu cost"              |

---

## 10. Technical Architecture Overview

```
+-------------------+     +-------------------+     +-------------------+
|   Cloudflare      |     |   PayloadCMS      |     |   PostgreSQL      |
|   Pages (Next.js) |<--->|   (Headless API)  |<--->|   (Supabase)      |
+-------------------+     +-------------------+     +-------------------+
         ^                         ^                         ^
         |                         |                         |
         v                         v                         v
+-------------------+     +-------------------+     +-------------------+
|   Static Pages    |     |   BullMQ Jobs     |     |   Redis           |
|   (ISR/SSG)       |     |   (Scraping)      |     |   (Cache/Queue)   |
+-------------------+     +-------------------+     +-------------------+
                                   |
                                   v
                          +-------------------+
                          |   SOAX API        |
                          |   (Web Fetching)  |
                          +-------------------+
```

### Data Flow

1. **Scraping Pipeline** (Daily)
   - BullMQ triggers scraping jobs
   - SOAX API fetches provider pricing pages
   - Custom adapters parse pricing data
   - Data validated and stored in PostgreSQL
   - Cache invalidated in Redis

2. **Page Generation**
   - Next.js builds static pages at deploy time
   - ISR regenerates pages on demand (24hr cache)
   - PayloadCMS API provides dynamic data
   - Cloudflare CDN serves static assets

3. **User Request Flow**
   - User requests page from Cloudflare edge
   - Static HTML served immediately
   - Client-side hydration for interactivity
   - Affiliate clicks tracked via API endpoint

---

## Appendix A: Provider List (Initial 40+)

### Specialized AI Clouds

1. Lambda Labs
2. CoreWeave
3. Nebius
4. Voltage Park
5. Crusoe Energy
6. Together AI
7. Anyscale
8. Modal

### Bare Metal / IaaS

9. Hetzner
10. OVHcloud
11. Latitude.sh
12. Paperspace
13. Genesis Cloud

### DePIN / Marketplaces

14. Vast.ai
15. RunPod
16. io.net
17. Salad
18. Akash Network
19. TensorDock

### Hyperscalers

20. AWS (EC2 P5/P4)
21. Google Cloud (A3/A2)
22. Microsoft Azure (ND H100)
23. Oracle Cloud
24. IBM Cloud

### Regional Providers

25. GMI Cloud (APAC)
26. Hyperstack (EU)
27. Scaleway (EU)
28. Vultr
29. DataCrunch
30. LeaderGPU

### Inference-Focused

31. Replicate
32. Banana.dev
33. Baseten
34. Beam

### Additional Providers

35-45+: (To be added during research phase)

---

## Appendix B: GPU Model Specifications

| Model     | Architecture | VRAM        | Memory BW | TDP   | Primary Use         |
| --------- | ------------ | ----------- | --------- | ----- | ------------------- |
| B200      | Blackwell    | 192GB HBM3e | 8 TB/s    | 1000W | Training            |
| H200      | Hopper       | 141GB HBM3e | 4.8 TB/s  | 700W  | Training/Inference  |
| H100 SXM  | Hopper       | 80GB HBM3   | 3.35 TB/s | 700W  | Training            |
| H100 PCIe | Hopper       | 80GB HBM3   | 2 TB/s    | 350W  | Training/Inference  |
| A100 80GB | Ampere       | 80GB HBM2e  | 2 TB/s    | 400W  | Training            |
| A100 40GB | Ampere       | 40GB HBM2e  | 1.55 TB/s | 400W  | Training            |
| L40S      | Ada          | 48GB GDDR6  | 864 GB/s  | 350W  | Inference           |
| RTX 5090  | Blackwell    | 32GB GDDR7  | 1.79 TB/s | 575W  | Inference/Fine-tune |
| RTX 4090  | Ada          | 24GB GDDR6X | 1 TB/s    | 450W  | Inference/Fine-tune |

---

## Appendix C: Pricing Reference (Dec 2025)

| GPU       | Low (DePIN)    | Mid (Specialized) | High (Hyperscaler) |
| --------- | -------------- | ----------------- | ------------------ |
| B200      | N/A            | $5.29 (Lambda)    | $8.60 (CoreWeave)  |
| H200      | $2.19 (Vast)   | $2.50 (GMI)       | $6.31 (CoreWeave)  |
| H100 SXM  | $1.56 (Vast)   | $1.99 (Voltage)   | $6.16 (CoreWeave)  |
| H100 PCIe | $0.89 (io.net) | $1.99 (RunPod)    | $3.00+ (AWS)       |
| RTX 5090  | $0.25 (Salad)  | $0.89 (RunPod)    | N/A                |
| RTX 4090  | $0.20 (Salad)  | $0.44 (RunPod)    | N/A                |

---

## Document History

| Version | Date       | Author          | Changes              |
| ------- | ---------- | --------------- | -------------------- |
| 1.0     | 2025-12-30 | Product Manager | Initial PRD creation |

---

**Next Steps**:

1. Review with stakeholders
2. Prioritize P0 features for Sprint 1
3. Create technical design document
4. Set up project infrastructure
5. Begin development
