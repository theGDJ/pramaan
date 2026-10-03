"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  Clock3,
  FileCheck2,
  FlaskConical,
  IndianRupee,
  Printer,
  Search,
  Sparkles,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { COMPARISON, FAQS, INDICATIVE_NOTE, READINESS, SCHEMES } from "./data";

export type CertStats = {
  standards: number;
  mandatory: number;
  labs: number;
  ahc: number;
  schemes: { scheme: string; count: number }[];
  qcos: { qco: string; count: number }[];
};

const STORAGE_KEY = "pramaan_cert_checklist";
const CHECKLIST_EVENT = "pramaan-checklist";

/* Document-checklist state lives in localStorage and is exposed through
 * useSyncExternalStore so no effect has to call setState after mount. */
let cacheRaw: string | null = null;
let cacheVal: Record<string, boolean> = {};
function readChecklist(): Record<string, boolean> {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheVal = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      cacheVal = {};
    }
  }
  return cacheVal;
}
const EMPTY_CHECKLIST: Record<string, boolean> = {};
function subscribeChecklist(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(CHECKLIST_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHECKLIST_EVENT, cb);
  };
}
function writeChecklist(next: Record<string, boolean>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHECKLIST_EVENT));
}

const PERSONAS = [
  { id: "manufacturer", label: "Indian manufacturer" },
  { id: "importer", label: "Importer / brand owner" },
  { id: "foreign", label: "Foreign manufacturer" },
  { id: "jeweller", label: "Jeweller / retailer" },
  { id: "consumer", label: "Consumer / buyer" },
];

const AREAS = [
  { id: "construction", label: "Construction & steel" },
  { id: "electronics", label: "Electricals & electronics" },
  { id: "food", label: "Food, water & agriculture" },
  { id: "consumer", label: "Consumer goods & toys" },
  { id: "jewellery", label: "Gold & silver jewellery" },
  { id: "machinery", label: "Machinery & engineering" },
];

function recommend(persona: string, area: string) {
  if (persona === "jeweller" || area === "jewellery")
    return {
      id: "hallmark",
      why:
        "Jewellery is certified by fineness at a BIS-recognized Assaying & Hallmarking Centre, not by a factory licence. Gold hallmarking is mandatory in notified districts and every article gets a unique HUID.",
    };
  if (persona === "foreign")
    return {
      id: "fmcs",
      why:
        "Products made outside India are licensed under FMCS against the overseas factory, with an Authorized Indian Representative and a BIS audit abroad — goods must be certified before they are imported.",
    };
  if (area === "electronics" && persona !== "consumer")
    return {
      id: "crs",
      why:
        "Most electricals, electronics and IT goods are notified under the Compulsory Registration Scheme: a model tested at a recognized lab, registered online, then marked with the R-number — no factory audit.",
    };
  if (persona === "consumer")
    return {
      id: "eco",
      why:
        "For a buyer, the useful part of the system is verification: match the CM/L- or R- number (or the HUID on jewellery) with the official BIS registry, and prefer voluntarily certified products where no QCO applies.",
    };
  return {
    id: "isi",
    why:
      "Products made in India with an applicable Indian Standard follow Scheme-I: application, factory audit, independent testing and an ISI licence with a CM/L- number. Certification is compulsory wherever a QCO applies.",
  };
}

export function CertificationClient({ stats }: { stats: CertStats }) {
  const [active, setActive] = useState("isi");
  const [persona, setPersona] = useState("manufacturer");
  const [area, setArea] = useState("construction");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const checked = useSyncExternalStore(subscribeChecklist, readChecklist, () => EMPTY_CHECKLIST);


  const scheme = SCHEMES.find((s) => s.id === active)!;
  const recommendation = useMemo(() => {
    const r = recommend(persona, area);
    return { ...r, scheme: SCHEMES.find((s) => s.id === r.id)! };
  }, [persona, area]);

  const matches = useMemo(() => {
    const ids = new Set<string>();
    for (const item of READINESS) if (answers[item.id]) item.schemes.forEach((s) => ids.add(s));
    return SCHEMES.filter((s) => ids.has(s.id));
  }, [answers]);

  const answered = READINESS.filter((r) => answers[r.id]).length;
  const doneDocs = scheme.documents.filter((d) => checked[`${scheme.id}:${d}`]).length;
  const pct = Math.round((doneDocs / scheme.documents.length) * 100);

  return (
    <div className="space-y-14">
      {/* ------------------------------- stats strip ------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Indian Standards in catalogue", v: stats.standards, hint: "searchable, clause-level" },
          { k: "QCO-notified (mandatory)", v: stats.mandatory, hint: "certification cannot be skipped" },
          { k: "Testing facilities", v: stats.labs, hint: "BIS, NTH, STQC, CSIR & recognized labs" },
          { k: "Assaying & hallmarking centres", v: stats.ahc, hint: "gold & silver fineness" },
        ].map((s) => (
          <div key={s.k} className="panel p-5">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-ash-500">{s.k}</div>
            <div className="font-display mt-2 text-3xl font-semibold text-gold-200">
              {s.v.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-[12px] text-ash-500">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* --------------------------- route recommendation --------------------------- */}
      <section className="panel p-7">
        <div className="kicker mb-2 flex items-center gap-2">
          <Sparkles className="size-4" /> FIND MY CERTIFICATION ROUTE
        </div>
        <h2 className="font-display text-2xl font-semibold text-white">
          Two questions, one recommended route
        </h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mono mb-2 text-[10px] uppercase tracking-[0.22em] text-ash-500">I am a…</div>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  className={`chip px-3.5 py-2 text-[12px] transition-colors ${
                    persona === p.id ? "chip-gold" : "text-ash-400 hover:text-gold-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mono mb-2 text-[10px] uppercase tracking-[0.22em] text-ash-500">My product is…</div>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setArea(a.id)}
                  className={`chip px-3.5 py-2 text-[12px] transition-colors ${
                    area === a.id ? "chip-gold" : "text-ash-400 hover:text-gold-200"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={recommendation.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="mt-6 rounded-2xl border border-gold-500/30 bg-gold-400/5 p-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              <recommendation.scheme.icon className="size-5 text-gold-300" />
              <span className="font-display text-xl font-semibold text-gold-100">
                {recommendation.scheme.name}
              </span>
              <span className="chip chip-gold py-1 text-[10px]">{recommendation.scheme.tab}</span>
            </div>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ash-300">{recommendation.why}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setActive(recommendation.id)}
                className="btn-gold px-4 py-2 text-[12.5px]"
              >
                Open the walkthrough <ArrowRight className="size-3.5" />
              </button>
              <Link
                href={`/assistant?q=${encodeURIComponent(recommendation.scheme.ask)}`}
                className="btn-ghost px-4 py-2 text-[12.5px]"
              >
                Ask the assistant
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* --------------------------------- scheme tabs --------------------------------- */}
      <section>
        <div className="mb-5 flex flex-wrap gap-2">
          {SCHEMES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`chip inline-flex items-center gap-2 px-4 py-2.5 text-[12px] transition-colors ${
                active === s.id ? "chip-gold" : "text-ash-400 hover:text-gold-200"
              }`}
            >
              <s.icon className="size-3.5" />
              {s.tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={scheme.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-5 xl:grid-cols-[1fr_390px]"
          >
            {/* left column */}
            <div className="space-y-5">
              <div className="panel p-7">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-2xl font-semibold text-white">{scheme.name}</h3>
                  <span className="chip chip-gold inline-flex items-center gap-1.5 py-1">
                    <Clock3 className="size-3.5" /> {scheme.timeline}
                  </span>
                </div>
                <p className="text-[14px] leading-relaxed text-gold-100/90">{scheme.tagline}</p>
                <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ash-400">{scheme.audience}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-ink-900/60 p-4">
                    <div className="kicker mb-1.5">Legal basis</div>
                    <div className="text-[12.5px] leading-relaxed text-ash-300">{scheme.legalBasis}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-ink-900/60 p-4">
                    <div className="kicker mb-1.5">Validity</div>
                    <div className="text-[12.5px] leading-relaxed text-ash-300">{scheme.validity}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-coral-400/30 bg-coral-400/5 p-4">
                  <div className="kicker mb-1.5 text-coral-400">When it is compulsory</div>
                  <div className="text-[12.5px] leading-relaxed text-ash-300">{scheme.whenMandatory}</div>
                </div>

                {/* steps rail */}
                <div className="mt-8">
                  <div className="kicker mb-5">Step-by-step route</div>
                  <div className="space-y-0">
                    {scheme.steps.map((s, i) => (
                      <div key={s.title} className="relative flex gap-5 pb-7 last:pb-0">
                        {i < scheme.steps.length - 1 && (
                          <span className="absolute left-[15px] top-9 h-[calc(100%-18px)] w-px bg-gradient-to-b from-gold-500/50 to-line" />
                        )}
                        <span className="mono z-10 grid size-8 shrink-0 place-items-center rounded-lg border border-gold-500/40 bg-ink-900 text-[11px] text-gold-300">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[15px] font-semibold text-white">{s.title}</span>
                            {s.days && <span className="chip py-0.5 text-[9.5px]">{s.days}</span>}
                          </div>
                          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ash-400">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* documents checklist */}
              <div className="panel p-7">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                  <div className="kicker flex items-center gap-2">
                    <FileCheck2 className="size-4" /> DOCUMENT CHECKLIST
                  </div>
                  <span className="mono text-[11px] text-ash-500">
                    {doneDocs}/{scheme.documents.length} READY · {pct}%
                  </span>
                </div>
                <div className="mb-5 mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {scheme.documents.map((d) => {
                    const key = `${scheme.id}:${d}`;
                    const on = !!checked[key];
                    return (
                      <button
                        key={d}
                        onClick={() => writeChecklist({ ...checked, [key]: !checked[key] })}
                        className={`flex items-start gap-3 rounded-xl border p-3.5 text-left text-[12.5px] leading-relaxed transition-colors ${
                          on
                            ? "border-jade-500/40 bg-jade-500/10 text-ash-200"
                            : "border-line bg-ink-900/50 text-ash-400 hover:border-gold-500/40"
                        }`}
                      >
                        {on ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-jade-400" />
                        ) : (
                          <span className="mt-0.5 size-4 shrink-0 rounded-full border border-line" />
                        )}
                        {d}
                      </button>
                    );
                  })}
                </div>
                <div className="mono mt-4 text-[10.5px] text-ash-500">
                  TICKED ITEMS ARE SAVED IN THIS BROWSER — PRINT BEFORE A CONSULTANT MEETING.
                </div>
              </div>

              {/* pitfalls */}
              <div className="panel-flat p-6">
                <div className="kicker mb-4 flex items-center gap-2 text-coral-400">
                  <TriangleAlert className="size-4" /> WHY APPLICATIONS GET REJECTED
                </div>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {scheme.pitfalls.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[13px] leading-relaxed text-ash-300">
                      <XCircle className="mt-0.5 size-4 shrink-0 text-coral-400" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* right column */}
            <div className="space-y-5">
              <div className="panel-flat p-6">
                <div className="kicker mb-4 flex items-center gap-2">
                  <IndianRupee className="size-4" /> INDICATIVE COST STRUCTURE
                </div>
                <ul className="space-y-3">
                  {scheme.fees.map((f) => (
                    <li key={f.item} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium text-ash-200">{f.item}</span>
                        <span className="mono text-[12px] text-gold-300">{f.amount}</span>
                      </div>
                      {f.note && <div className="mt-1 text-[11.5px] leading-relaxed text-ash-500">{f.note}</div>}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] leading-relaxed text-ash-500">{INDICATIVE_NOTE}</p>
              </div>

              <div className="panel-flat p-6">
                <div className="kicker mb-4">WHAT MUST APPEAR ON THE PRODUCT</div>
                <ul className="space-y-2.5">
                  {scheme.marking.map((m) => (
                    <li key={m} className="flex gap-2.5 text-[13px] leading-relaxed text-ash-300">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-jade-400" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel-flat p-6">
                <div className="kicker mb-4">AFTER CERTIFICATION</div>
                <ul className="space-y-2.5">
                  {scheme.after.map((a) => (
                    <li key={a} className="flex gap-2.5 text-[13px] leading-relaxed text-ash-300">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-[3px] bg-gold-400" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel-flat space-y-2.5 p-6">
                <div className="kicker mb-2">GO STRAIGHT TO</div>
                <Link
                  href={`/standards?q=${encodeURIComponent(scheme.standardsQuery)}`}
                  className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-[13px] text-ash-300 transition-colors hover:border-gold-500/40 hover:text-gold-200"
                >
                  <span className="inline-flex items-center gap-2">
                    <Search className="size-4 text-gold-400" /> Standards for this route
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href={`/labs?capability=${scheme.labCapability}`}
                  className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-[13px] text-ash-300 transition-colors hover:border-gold-500/40 hover:text-gold-200"
                >
                  <span className="inline-flex items-center gap-2">
                    <FlaskConical className="size-4 text-gold-400" /> Labs that can test this
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href={`/assistant?q=${encodeURIComponent(scheme.ask)}`}
                  className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-[13px] text-ash-300 transition-colors hover:border-gold-500/40 hover:text-gold-200"
                >
                  <span className="inline-flex items-center gap-2">
                    <BookOpen className="size-4 text-gold-400" /> Ask Pramaan about it
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
                <button
                  onClick={() => window.print()}
                  className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-[13px] text-ash-300 transition-colors hover:border-gold-500/40 hover:text-gold-200"
                >
                  <span className="inline-flex items-center gap-2">
                    <Printer className="size-4 text-gold-400" /> Print this walkthrough
                  </span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ------------------------------- comparison ------------------------------- */}
      <section>
        <div className="kicker mb-3">SIDE BY SIDE</div>
        <h2 className="font-display text-3xl font-semibold text-white">Compare the five routes</h2>
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="p-4 text-[11px] font-normal uppercase tracking-[0.18em] text-ash-500">Parameter</th>
                {["Scheme-I (ISI)", "CRS (Scheme-II)", "FMCS", "Hallmarking", "Scheme-IV (CoC)"].map((h) => (
                  <th key={h} className="p-4 font-display text-[15px] font-semibold text-gold-200">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label} className="border-b border-line/60 last:border-0">
                  <td className="p-4 text-[12px] uppercase tracking-[0.12em] text-ash-500">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="p-4 text-[12.5px] leading-relaxed text-ash-300">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------- readiness ------------------------------- */}
      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="panel p-7">
          <div className="kicker mb-2">READINESS CHECK</div>
          <h2 className="font-display text-2xl font-semibold text-white">
            Tick what is true — see which routes apply
          </h2>
          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {READINESS.map((r) => {
              const on = !!answers[r.id];
              return (
                <button
                  key={r.id}
                  onClick={() => setAnswers((a) => ({ ...a, [r.id]: !a[r.id] }))}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    on ? "border-gold-500/50 bg-gold-400/10" : "border-line bg-ink-900/50 hover:border-gold-500/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {on ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold-300" />
                    ) : (
                      <span className="mt-0.5 size-4 shrink-0 rounded-full border border-line" />
                    )}
                    <div>
                      <div className={`text-[13.5px] font-medium ${on ? "text-gold-100" : "text-ash-200"}`}>
                        {r.q}
                      </div>
                      <div className="mt-1 text-[11.5px] leading-relaxed text-ash-500">{r.hint}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel-flat p-6">
          <div className="kicker mb-4">YOUR APPLICABLE ROUTES</div>
          {answered === 0 && (
            <p className="text-[13px] leading-relaxed text-ash-500">
              Tick any statement on the left. Routes that match will appear here with a jump link into the detailed
              walkthrough.
            </p>
          )}
          {answered > 0 && matches.length === 0 && (
            <p className="text-[13px] leading-relaxed text-ash-400">
              Nothing matched — most likely your product is not notified, so voluntary certification (ISI / ECO) is the
              practical route. Ask the assistant with your product name for a definitive answer.
            </p>
          )}
          <div className="space-y-2.5">
            {matches.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left text-[13px] text-ash-300 transition-colors hover:border-gold-500/40 hover:text-gold-200"
              >
                <span className="inline-flex items-center gap-2">
                  <m.icon className="size-4 text-gold-400" /> {m.name}
                </span>
                <ArrowRight className="size-4" />
              </button>
            ))}
          </div>
          {answered > 0 && (
            <Link
              href="/assistant?q=Which%20BIS%20scheme%20applies%20to%20my%20product%20and%20what%20will%20it%20cost%3F"
              className="btn-gold mt-5 w-full justify-center px-4 py-2.5 text-[12.5px]"
            >
              Confirm with the assistant <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </section>

      {/* ----------------------------------- QCOs ----------------------------------- */}
      <section>
        <div className="kicker mb-3">WHAT MAKES CERTIFICATION COMPULSORY</div>
        <h2 className="font-display text-3xl font-semibold text-white">Quality Control Orders in the catalogue</h2>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ash-400">
          A QCO is the legal hook that turns a voluntary standard into a mandatory mark. These are the orders behind the
          products in the Pramaan catalogue — open one to see every notified standard.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {stats.qcos.map((q) => (
            <Link
              key={q.qco}
              href={`/standards?mandatory=true&q=${encodeURIComponent(q.qco.replace(/ \(.*\)/, ""))}`}
              className="chip chip-coral px-3.5 py-2 text-[11.5px] transition-transform hover:-translate-y-0.5"
            >
              {q.qco} · {q.count}
            </Link>
          ))}
        </div>
      </section>

      {/* ----------------------------------- FAQ ----------------------------------- */}
      <section>
        <div className="kicker mb-3">QUESTIONS THAT COME UP EVERY TIME</div>
        <h2 className="font-display text-3xl font-semibold text-white">Certification FAQ</h2>
        <div className="mt-6 space-y-2.5">
          {FAQS.map((f, i) => (
            <div key={f.q} className="panel-flat overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
              >
                <span className="text-[14.5px] font-medium text-white">{f.q}</span>
                <ChevronDown
                  className={`size-4 shrink-0 text-gold-300 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-ash-400">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-ash-500">
        Pramaan is a demonstration assistant. Legal positions, fee schedules and scheme names are summarised from the BIS
        Act, 2016 and BIS (Conformity Assessment) Regulations, 2018 for guidance only — verify the current position with
        the Bureau of Indian Standards before you file.
      </p>
    </div>
  );
}
