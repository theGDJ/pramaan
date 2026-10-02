# PRAMAAN — Code Architecture Report

**App:** AI assistant for Indian Standards & BIS services (Smart India Hackathon 2026 · SIH26107)
**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL + Drizzle ORM · framer-motion · lucide-react

```
Browser (React clients)
   │  fetch
   ▼
Next.js API routes  (/api/chat, /api/finder, /api/standards, /api/labs,
   │                /api/verify, /api/complaints, /api/stats, /api/health)
   ▼
lib/assistant/engine.ts  ── the "AI" brain (intent → retrieve → compose → cite)
   │            └── lib/assistant/products.ts  (20 product-family profiles)
   │            └── lib/i18n.ts                (EN/HI locale detection + UI strings)
   ▼
db/index.ts (pg Pool + Drizzle)  →  PostgreSQL (app_db)
```

---

## 1. Data layer — `src/db/`

### `src/db/index.ts` — connection
- Reads `DATABASE_URL` from `.env` (throws if missing).
- Creates a `pg.Pool` and wraps it with `drizzle(pool)`.
- On `NODE_ENV=development` the pool is cached on `globalThis` so Next.js hot reloads don't leak connections.

### `src/db/schema.ts` — 7 tables (Drizzle `pgTable`)

| Table | Purpose | Notable columns |
|---|---|---|
| `standards` | The Indian Standards catalogue | `code` (unique, e.g. "IS 456:2000"), `category`, `mandatory` (QCO flag), `scheme`, `qco`, `keywords text[]`, `sections jsonb` (clause/title/summary list), `related text[]`, `editions` |
| `knowledge_docs` | Scheme/process/FAQ knowledge articles | `slug` (unique), `kind` (scheme/process/faq/consumer/fees/hallmark/labs/concept), `body`, `body_hi` (Hindi), `keywords`, `refs jsonb` (citations) |
| `labs` | BIS + recognized testing labs & AHCs | `kind` ("BIS Laboratory" / "Recognized Laboratory" / "AHC"), `capabilities text[]`, `standards text[]` |
| `licences` | Demo verification registry | `mark_no` (unique: CM/L-, R-, HM/C-, or 6-char HUID), `type` (isi/crs/jeweller/huid), `status` (valid/suspended/expired) |
| `chat_sessions` | One row per conversation | `id uuid default random()`, `locale` |
| `chat_messages` | Full transcript | `session_id → chat_sessions (cascade)`, `role` (user/assistant), `content`, `intent`, `citations jsonb` |
| `complaints` | Consumer grievance tickets | `ticket` (BISC-YYYY-######), `name`, `email`, `category`, `product`, `description` |

Indexes: `standards(category)`, `standards(mandatory)`, `docs(kind)`, `labs(state)`.

### `src/db/seed.ts` — knowledge base loader
Run with `npx tsx --env-file=.env src/db/seed.ts`. It deletes all four content tables then inserts:
- **36 standards** — each with summary, keyword array (incl. Hindi Devanagari terms like "सीमेंट", "सरिया"), key clause sections, related standards.
- **13 knowledge docs** — bilingual (EN + HI) explainers for schemes, QCOs, hallmarking, fees, consumer verification.
- **24 labs** — BIS regional labs, National Test House, private recognized labs, with capability categories.
- **16 licences** — demo registry entries across all four mark types (ISI, CRS, jeweller, HUID), including deliberately *suspended* and *expired* ones so the verifier shows realistic statuses.

---

## 2. Intelligence layer — `src/lib/`

### `src/lib/i18n.ts` — bilingual support
- `Locale = "en" | "hi"`; `UI` dictionary maps ~16 UI keys per language.
- `t(locale, key)` with English fallback.
- `detectLocale(text)`: if the query contains any Devanagari codepoint (`\u0900-\u097F`) → Hindi. This is how the bot auto-replies in the language of the question.

### `src/lib/assistant/products.ts` — product → standard mapping
- 20 hard-coded `ProductProfile`s: cement, TMT steel, gold, silver, IT electronics, batteries, cables, plugs/switches, fans, LED lamps, helmets, pressure cookers, packaged water, pipes, toys, LPG cylinders/stoves, energy meters, MCBs/RCCBs, fire extinguishers, plywood, masks.
- Each profile: bilingual label, `aliases` (English + Hindi: "tmt", "सरिया", "saria"…), `category`, the applicable IS codes, `scheme` (scheme1/scheme2/hallmark/scheme4/voluntary), `mandatory` flag, and a bilingual regulatory note.
- `matchProducts(query)`: lowercases the query, scans every alias as a substring; aliases longer than 4 chars score 3, shorter score 2; returns the **top 3 profiles** by score. This powers both the Finder page and the assistant's product enrichment.

### `src/lib/assistant/engine.ts` — the assistant brain
A deterministic, retrieval-augmented **rule engine** (no external LLM needed — every answer is composed from the DB, so it's fast, free, offline-capable and always citable).

**Pipeline** (`answer(query, localeHint)`):
1. **Locale detection** — `detectLocale()` on the raw query.
2. **Intent classification** — `classify()`:
   - If the query contains an IS-code pattern (`IS_RE = /(?:is|आईएस)[\s:/-]*(\d{2,6})(?:\s*[-–]\s*(\d+))?/i` — matches "IS 456:2000", "is-694", "आईएस 2347") **and** the rest of the query is < 30 chars → `standard_lookup`.
   - Otherwise, score 9 intent groups (`hallmarking`, `labs`, `consumer`, `fees`, `process`, `scheme`, `find_standard`, `greeting`, `about`) against bilingual keyword lists — each hit scores 1, keywords longer than 5 chars score 2; the highest-scoring intent wins.
   - No keyword hit but an IS code present → `standard_lookup`; a product alias matched → `find_standard`; else `fallback`.
3. **Product matching** — `matchProducts()` runs for every query (used to enrich several intents).
4. **Dispatch to a composer** — one function per intent, each returning `{ intent, text (markdown), citations[], suggestions[], locale }`.

**Retrieval helpers:**
- `findByCodeCodeFragment(fragment)` — `LIKE '%fragment%'` on the `code` column.
- `fullTextStandards(query)` — tokenizes (Unicode-aware, strips punctuation, keeps words > 2 chars, max 6 tokens), builds an `OR` across `lower(title)`, `lower(summary)`, and `lower(array_to_string(keywords,' '))`, then re-scores rows in JS by **token frequency** in `title+summary+keywords`, +0.5 if `mandatory`; returns top 5.
- `docsByKind(...kinds)` — filters the knowledge-doc table by kind.
- `labsFor(categories)` — scores labs +2 per matching capability, returns top 4.

**Composers (each bilingual via the `L(locale, en, hi)` helper):**
- `answerGreeting` — capability menu + starter suggestions.
- `answerStandardLookup` — resolves the code, renders status/editions/QCO/scheme, **key clauses** (from the `sections` jsonb), related standards; citations include clause-level refs (e.g. `IS 269:2015 · Clause 7.2`). If the code isn't in the catalogue it falls back to full-text, then to a "not found" tip.
- `answerFindStandard` — renders one block per matched product profile (applicable standards, scheme label, mandatory/voluntary verdict) with a citation per standard; if no profile matched, uses `fullTextStandards`.
- `answerScheme` — the four conformity-assessment schemes; **enriched at dispatch time** if a product matched, appending a "For your product specifically" block.
- `answerProcess` — 7-step ISI licensing journey + timeline, CRS variant note.
- `answerHallmark` — mandatory/voluntary status, the three hallmark elements, and a **conditional 3-step verification guide** injected when the query mentions verify/check/HUID/जाँच.
- `answerLabs` — labs matching the product's category with test-standards lists.
- `answerConsumer` / `answerFees` / `answerAbout` — guidance articles with fee structure, concessions, complaint channels (BIS Care App, 1915) and penalties under the BIS Act 2016.
- `answerFallback` — honest "not sure" + related standards from full-text search.

Every composer always attaches **citations** (`{ kind: standard|doc|lab, ref, label, clause? }`) — the UI renders them as chips under each answer.

---

## 3. API layer — `src/app/api/` (all routes `force-dynamic`)

### `POST /api/chat` — assistant endpoint
1. Parse body: `message` (trim, reject empty or > 2000 chars → 400), optional `sessionId`, `locale`.
2. No session? Insert a `chat_sessions` row and return its UUID.
3. Insert the **user** message.
4. Call `answer(message, locale)` → engine result.
5. Insert the **assistant** message with `intent` and `citations` (this powers the Insights dashboard).
6. Return `{ sessionId, intent, text, citations, suggestions }`.

`GET /api/chat?sessionId=…` returns the session's last 50 messages (fetched desc, reversed to chronological) — used to restore conversations.

### `POST /api/finder` — product identification
1. `matchProducts(query)` → profiles.
2. **Matched:** for each profile, select its standards from the DB (joining on the number fragment of the IS code), pick up to 6 labs whose `capabilities` include the profile's category, and attach `PROCESS_STEPS[scheme]` (hard-coded step lists for scheme1/scheme2/hallmark/scheme4) plus a timeline estimate.
3. **Not matched:** tokenize the query (max 4 words > 2 chars), `ILIKE` fallback across `code`/`title`, return up to 6 raw standards with `matched: false`.

### `GET /api/standards` — catalogue search
- Query params: `q`, `category`, `mandatory=true`, `code`.
- Builds AND-combined conditions; for each `q` token an OR across `code ILIKE`, `title ILIKE`, `summary ILIKE` and a Postgres `EXISTS (SELECT 1 FROM unnest(keywords) k WHERE lower(k) LIKE …)` against the keyword array.
- **Weighted ranking in JS:** code hit +8, title +5, keyword +4, summary +1, mandatory +0.5. No query → alphabetical by code. Limit 100.

### `GET /api/labs` — lab directory
- Loads all labs ordered by state/city, filters by `state`/`kind`/`capability` in JS, also returns the distinct state list for the UI dropdown.

### `POST /api/verify` — licence / HUID checker
- Uppercases the input, requires ≥ 4 chars, `ILIKE '%number%'` over `licences.mark_no`, returns up to 3 hits with full registry rows (holder, product, standard, status, validity, city) or `{ found: false }`.

### `POST /api/complaints` — grievance filing
- Validates name, email contains "@", product, and description ≥ 20 chars → otherwise 400.
- Generates ticket `BISC-<year>-<6 random digits>`, inserts, returns the ticket.

### `GET /api/stats` — dashboard feed
- Counts: standards, mandatory standards, labs, licences, assistant answers, complaints.
- Intent histogram (`GROUP BY intent` on assistant messages), category histogram.
- **Top cited standards:** scans the last 200 assistant messages' `citations` jsonb, tallies `kind === "standard"` refs, top 6.
- 7 most recent user queries.

### `GET /api/health`
- `SELECT 1` via Drizzle → `{ ok: true }` or 500.

---

## 4. UI layer — `src/app/` + `src/components/`

### Shell
- **`layout.tsx`** — loads three Google fonts via `next/font`: Fraunces (display serif), Space Grotesk (UI), JetBrains Mono (code/labels); sets metadata and the dark `ink-950` body.
- **`Chrome.tsx`** — `Nav` (fixed glass pill header, active-route highlight via `usePathname`, mobile hamburger), `Footer` (branding, links, SIH disclaimer), `PageShell` (kicker + title + blueprint-grid/glow backdrop for inner pages).
- **`motion.tsx`** — `Reveal` (framer-motion `whileInView` blur+rise entrance with stagger index) and `AskBar` (hero search that routes to `/assistant?q=<query>`).

### Pages
| Route | Type | What it does |
|---|---|---|
| `/` (home) | Server | Hero + AskBar, preset question chips, **live DB stat tiles** (36 IS / 28 mandatory / 24 labs / 16 marks / N answered), 8-service grid, 3-step "how answers are built", 4 scheme cards, bilingual CTA |
| `/assistant` | Server shell + `ChatClient` | The chat app (below) |
| `/finder` | Server shell + `FinderClient` | Product → standard wizard (below) |
| `/standards` | Server shell + `StandardsClient` | Catalogue explorer: 180 ms-debounced search with `AbortController` cancellation, category chips, mandatory-only toggle, list + **detail drawer** (clauses, related, editions) |
| `/labs` | Server shell + `LabsClient` | Directory: state / type / capability dropdowns → `/api/labs`, cards with contacts and tested standards |
| `/guide` | Server | Renders knowledge docs from the DB grouped by kind (scheme, process, fees, hallmark, consumer) |
| `/consumer` | Client | **Verify card** (POST /api/verify, sample numbers, status colour chips: valid/suspended/expired) + **complaint form** (POST /api/complaints → animated ticket confirmation) + helpline 1915 info |
| `/dashboard` | Server | Insights: six count tiles, intent bar chart (CSS widths), category donut (SVG), top-cited standards, recent queries — all live from `/api/stats` data computed server-side |

### `ChatClient.tsx` — the chat experience
- **Markdown-lite renderer** (hand-rolled, zero deps): `**bold**`, `_italic_`, `- bullets` (gold square markers), `1. numbered` (mono number badges), `---` separators, paragraphs. Deliberately avoids a markdown library to keep the bundle tiny and styling consistent with the design system.
- **State:** `messages[]`, `input`, `locale`, `busy`, `sessionId`. Session id is persisted in `localStorage` (`pramaan_session`) so refreshes restore the conversation (via GET /api/chat).
- **On mount:** reads `?q=` from the URL (this is how the home AskBar deep-links a question) and sends it, otherwise sends "hello"/"नमस्ते" to trigger the greeting.
- **`send()`** — POSTs `{ message, sessionId, locale }`, appends user + assistant messages, stores the returned sessionId; a `sendingRef` guard prevents double-submits; Enter sends (Shift+Enter = newline); auto-scroll to bottom; network failure → inline error bubble.
- **Citation chips** — each assistant message lists its citations with an icon per kind (BookMarked = standard, FileText = doc, FlaskConical = lab), the ref in gold, truncated label, optional clause.
- **Suggestions** — the latest assistant message's `suggestions[]` render as clickable "Ask next" chips.
- **Toolbar** — EN/हिंदी toggle (switches UI strings via `t()`) and "New conversation" (clears state + localStorage).

### `FinderClient.tsx` — product wizard
- Preset chips (10 examples incl. one Hindi: "इस्पात सरिया") or free text → POST /api/finder.
- **Matched:** animated verdict panel — product name, note, MANDATORY·QCO (coral) or VOLUNTARY (jade) chip, scheme chip, timeline; two-column grid: applicable standards (from DB, with summaries) | numbered certification-path timeline; labs that test this family (cards with kind + city + standards).
- **Not matched:** amber warning panel suggesting concrete product names.
- Framer-motion `AnimatePresence` transitions between states.

### `globals.css` — design system (Tailwind v4)
- Custom palettes: `ink` (near-black surfaces), `gold` (brand accent), `ash` (text greys), `jade`/`coral` (status).
- Reusable component classes: `.panel`, `.panel-flat`, `.chip` (+ gold/jade/coral variants), `.btn-gold`, `.btn-ghost`, `.kicker`, `.mono`, `.card-hover`, plus the `.blueprint` grid and `.glow-gold` background effects.

---

## 5. End-to-end walkthrough

**"Is ISI mark mandatory for helmets?"** — typed in the chat:

1. `ChatClient.send()` POSTs to `/api/chat`.
2. Route validates and stores the user message; no session existed → a `chat_sessions` row is created, its UUID returned and cached in localStorage.
3. Engine: `detectLocale("Is ISI mark mandatory for helmets?")` → `en` (no Devanagari).
4. `classify()`: "isi" hits the `scheme` intent's keyword list (score 2, length > 5) → intent `scheme`.
5. `matchProducts()` finds the `helmet` profile via alias "helmet".
6. `answerScheme()` composes the four-scheme explainer; dispatch sees the product match and appends a helmet-specific block (IS 4151:2015, mandatory, Scheme-I) from `productBlock()`.
7. Route stores the assistant message with `intent: "scheme"` and citations (`scheme-isi` doc + `IS 4151:2015` standard).
8. Client renders markdown + citation chips + "Ask next" suggestions.

**"I make pressure cookers"** on the Finder:
`matchProducts` → `cooker` profile → `/api/finder` joins IS 2347:2017 from the DB, filters labs by `consumer` capability, attaches the 6-step Scheme-I path and "≈ 30–90 days" timeline → the UI animates in the verdict, standards, path and labs panels.

---

## 6. Design decisions & known limits

**Why a rule engine instead of an LLM?** Answers are fully determined by the seeded database — deterministic, sub-100 ms, zero API cost, works offline, and every claim is traceable to a citation. The `intent` + `citations` logged per message also make the Insights dashboard real analytics rather than decoration.

**Known limits (prototype scope):**
- Retrieval is `LIKE`/substring based, not true full-text or vector search — long natural-language queries may miss; ranking heuristics compensate.
- Product coverage is 20 curated families; unknown products fall back to token search or a graceful "cannot map".
- The licence registry is **demo data** — real verification needs the official BIS API/registry.
- `docsByKind` and `labsFor` load full tables and filter in JS — fine at this scale (13 docs / 24 labs), would need SQL filtering at production scale.
- `/api/chat` GET returns messages without auth — session UUIDs are the only access control, acceptable for a demo, not for production PII.
