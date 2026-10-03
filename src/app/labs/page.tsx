import { Nav, Footer, PageShell } from "@/components/Chrome";
import { LabsClient, type Lab } from "@/components/LabsClient";
import { db } from "@/db";
import { labs } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function LabsPage() {
  const rows = await db.select().from(labs).orderBy(labs.state, labs.city).limit(1000);
  const states = [...new Set(rows.map((r) => r.state))].sort();
  return (
    <>
      <Nav />
      <PageShell
        kicker="TESTING NETWORK"
        title="Laboratories & AHC Directory"
        sub="The complete Indian conformity-assessment network — BIS laboratories, National Test House, the STQC/ERTL electronics chain, CSIR and government labs, BIS-recognized private laboratories and Assaying & Hallmarking Centres, searchable by state, testing capability and facility type."
      >
        <LabsClient initial={rows as Lab[]} states={states} />
      </PageShell>
      <Footer />
    </>
  );
}
