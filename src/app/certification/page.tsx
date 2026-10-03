import { Nav, Footer, PageShell } from "@/components/Chrome";
import { db } from "@/db";
import { labs, standards } from "@/db/schema";
import { eq, isNotNull, sql, desc } from "drizzle-orm";
import { CertificationClient, type CertStats } from "./CertificationClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Certification Guide — ISI, CRS, FMCS, Hallmarking & CoC | Pramaan",
  description:
    "Interactive walkthroughs of every BIS conformity-assessment route: Scheme-I ISI licensing, CRS registration, FMCS for imports, gold hallmarking and Scheme-IV certificates of conformity — with fees, documents, timelines and testing labs.",
};

async function loadStats(): Promise<CertStats> {
  const [stdCount] = await db.select({ c: sql<number>`count(*)::int` }).from(standards);
  const [mandCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(standards)
    .where(eq(standards.mandatory, true));
  const [labCount] = await db.select({ c: sql<number>`count(*)::int` }).from(labs);
  const [ahcCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(labs)
    .where(eq(labs.kind, "AHC"));

  const schemeRows = await db
    .select({ scheme: standards.scheme, count: sql<number>`count(*)::int` })
    .from(standards)
    .where(eq(standards.mandatory, true))
    .groupBy(standards.scheme)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  const qcoRows = await db
    .select({ qco: standards.qco, count: sql<number>`count(*)::int` })
    .from(standards)
    .where(isNotNull(standards.qco))
    .groupBy(standards.qco)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    standards: Number(stdCount.c),
    mandatory: Number(mandCount.c),
    labs: Number(labCount.c),
    ahc: Number(ahcCount.c),
    schemes: schemeRows.map((r) => ({ scheme: r.scheme, count: Number(r.count) })),
    qcos: qcoRows.filter((r) => r.qco).map((r) => ({ qco: r.qco as string, count: Number(r.count) })),
  };
}

export default async function CertificationPage() {
  let stats: CertStats = { standards: 0, mandatory: 0, labs: 0, ahc: 0, schemes: [], qcos: [] };
  try {
    stats = await loadStats();
  } catch {
    /* the page still works from the curated content if the database is cold */
  }

  return (
    <>
      <Nav />
      <PageShell
        kicker="CERTIFICATION GUIDE"
        title="The road to the Standard Mark"
        sub="Six BIS conformity-assessment routes, decoded: who applies, what is compulsory, the documents, the fees, the timeline and what must be printed on the product. Pick your route, tick off the paperwork, and jump straight into the standards and labs you will need."
      >
        <CertificationClient stats={stats} />
      </PageShell>
      <Footer />
    </>
  );
}
