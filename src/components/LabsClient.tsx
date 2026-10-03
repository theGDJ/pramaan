"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FlaskConical, MapPin, Phone, Mail, Gem, Search, Building2 } from "lucide-react";

export type Lab = {
  id: number;
  name: string;
  city: string;
  state: string;
  kind: string;
  capabilities: string[];
  standards: string[];
  phone: string | null;
  email: string | null;
};

const CAPS = [
  { id: "all", label: "All capabilities" },
  { id: "electrical", label: "Electrical" },
  { id: "electronics", label: "Electronics" },
  { id: "construction", label: "Construction & Steel" },
  { id: "mechanical", label: "Mechanical" },
  { id: "plastics", label: "Plastics & Pipes" },
  { id: "food", label: "Food & Water" },
  { id: "chemicals", label: "Chemicals & Materials" },
  { id: "consumer", label: "Consumer Products" },
  { id: "hallmark", label: "Gold / Silver Assay" },
];

const KINDS = [
  { id: "all", label: "All types" },
  { id: "BIS Laboratory", label: "BIS Laboratories" },
  { id: "Recognized Laboratory", label: "Recognized Labs" },
  { id: "AHC", label: "Assaying & Hallmarking Centres" },
];

const PAGE = 48;

export function LabsClient({ initial, states }: { initial: Lab[]; states: string[] }) {
  /* deep links: /labs?capability=electronics&state=Gujarat — read straight from the URL */
  const params = useSearchParams();
  const [labs, setLabs] = useState(initial);
  const [state, setState] = useState(params.get("state") ?? "all");
  const [kind, setKind] = useState(params.get("kind") ?? "all");
  const [cap, setCap] = useState(params.get("capability") ?? "all");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    const ctl = new AbortController();
    const run = async () => {
      const sp = new URLSearchParams();
      if (state !== "all") sp.set("state", state);
      if (kind !== "all") sp.set("kind", kind);
      if (cap !== "all") sp.set("capability", cap);
      if (q.trim()) sp.set("q", q.trim());
      const res = await fetch(`/api/labs?${sp.toString()}`, { signal: ctl.signal });
      const d = await res.json();
      setLabs(d.labs);
      setShown(PAGE);
    };
    const id = setTimeout(run, q ? 200 : 0);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [state, kind, cap, q]);

  const counts = useMemo(
    () =>
      labs.reduce<Record<string, number>>((a, l) => {
        a[l.kind] = (a[l.kind] ?? 0) + 1;
        return a;
      }, {}),
    [labs],
  );

  return (
    <div>
      <div className="panel mb-6 space-y-4 p-5">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-900/80 px-3 focus-within:border-gold-500/60">
          <Search className="size-4 text-ash-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search facility, city or state — try “Mumbai”, “hallmark”, “electronics”…"
            className="w-full bg-transparent py-3 text-sm text-white placeholder:text-ash-500"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-xl border border-line bg-ink-900 px-3 py-3 text-sm text-ash-300"
          >
            <option value="all">All states & union territories ({states.length})</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-xl border border-line bg-ink-900 px-3 py-3 text-sm text-ash-300"
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
          <select
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="rounded-xl border border-line bg-ink-900 px-3 py-3 text-sm text-ash-300"
          >
            {CAPS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="mono text-[11px] tracking-[0.18em] text-ash-500">
          {labs.length} FACILIT{labs.length === 1 ? "Y" : "IES"} FOUND
        </div>
        <div className="flex flex-wrap gap-1.5">
          {kind === "all" &&
            Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <span key={k} className="chip py-0.5 text-[10px]">
                  {n} {k}
                </span>
              ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {labs.slice(0, shown).map((l) => (
          <div key={l.id} className="panel-flat card-hover p-5">
            <div className="flex items-start justify-between gap-2">
              {l.kind === "AHC" ? (
                <Gem className="size-5 text-gold-300" strokeWidth={1.6} />
              ) : (
                <FlaskConical className="size-5 text-gold-400" strokeWidth={1.6} />
              )}
              <span className={`chip py-1 text-[10px] ${l.kind === "BIS Laboratory" ? "chip-gold" : l.kind === "AHC" ? "chip-jade" : ""}`}>
                {l.kind}
              </span>
            </div>
            <h3 className="mt-3 text-[15px] font-semibold leading-snug text-white">{l.name}</h3>
            <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ash-400">
              <MapPin className="size-3.5" /> {l.city}, {l.state}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(l.capabilities ?? []).map((c) => (
                <span key={c} className="chip py-0.5 text-[9.5px] capitalize">{c}</span>
              ))}
            </div>
            <div className="mono mt-3 border-t border-line pt-3 text-[10.5px] leading-relaxed text-ash-500">
              TESTS · {(l.standards ?? []).slice(0, 4).join("  ·  ")}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-ash-500">
              {l.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3" /> {l.phone}
                </span>
              )}
              {l.email && (
                <span className="flex items-center gap-1.5 truncate">
                  <Mail className="size-3" /> {l.email}
                </span>
              )}
            </div>
          </div>
        ))}
        {labs.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-line py-14 text-center text-sm text-ash-500">
            No facility matches those filters. Broaden the search.
          </div>
        )}
      </div>

      {shown < labs.length && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => setShown((n) => n + PAGE)} className="btn-ghost px-6 py-3 text-sm">
            <Building2 className="size-4" /> Show {Math.min(PAGE, labs.length - shown)} more facilities
          </button>
        </div>
      )}
    </div>
  );
}
