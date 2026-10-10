import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";

export const LEDGER_FILENAME = "Jayant Solution — Global E-Commerce Lead Ledger (2026).xlsx";

const INDIA_BRANDS = [
  { name: "Apex Furniture Studio", domain: "apexfurniture.in", niche: "Home & Furniture", city: "Delhi", fact: "Shopify storefront with 140+ solid wood SKUs; mobile product gallery lacks zoom and slow LCP." },
  { name: "VedaGlow Naturals", domain: "vedaglownaturals.in", niche: "Beauty & Skincare", city: "Mumbai", fact: "Ayurvedic skincare D2C store; checkout flow requires 4 page reloads and lacks sticky cart." },
  { name: "KalaVastra Handlooms", domain: "kalavastrahandlooms.in", niche: "Fashion & Apparel", city: "Jaipur", fact: "Artisanal ethnic wear catalog; no size guide modal or automated WhatsApp order confirmation." },
  { name: "VoltEdge Audio India", domain: "voltedgeaudio.in", niche: "Electronics & Gadgets", city: "Bengaluru", fact: "Custom audio accessories store; product bundle upsell missing on cart drawer." },
  { name: "PranaLeaf Wellness", domain: "pranaleafwellness.in", niche: "Health & Nutrition", city: "Pune", fact: "Herbal tea & supplement brand; no subscription recurring order option." },
  { name: "UrbanCraft Decor", domain: "urbancraftdecor.in", niche: "Home & Furniture", city: "Gurugram", fact: "Contemporary lighting & decor brand; unoptimized hero PNG images (6.4MB)." },
  { name: "Zenvy Activewear", domain: "zenvyactive.in", niche: "Fashion & Apparel", city: "Hyderabad", fact: "D2C athleisure brand; search bar returns zero results on common typos." },
  { name: "Nirmal Spice Co", domain: "nirmalspices.co.in", niche: "Food & Beverage", city: "Kochi", fact: "Single-origin spice exporter; B2B wholesale inquiry form broken on mobile Safari." },
  { name: "Aether Watch Co", domain: "aetherwatches.in", niche: "Jewelry & Accessories", city: "Ahmedabad", fact: "Minimalist watch brand; product specification tabs do not expand on mobile." },
  { name: "LoomAura Carpets", domain: "loomauracarpets.in", niche: "Home & Furniture", city: "Varanasi", fact: "Hand-knotted rug store; custom dimension calculator missing from product page." },
];

const INTL_BRANDS = [
  { name: "NordicTimber Living", domain: "nordictimberliving.com", country: "USA", niche: "Home & Furniture", fact: "Custom oak furniture retailer; lacks 3D room preview and automated quote builder." },
  { name: "AuraBotanics London", domain: "aurabotanics.co.uk", country: "United Kingdom", niche: "Beauty & Skincare", fact: "Clean beauty brand in UK; quiz funnel lands on static page without product links." },
  { name: "DesertLuxe Perfumes", domain: "desertluxeperfumes.ae", country: "UAE", niche: "Beauty & Skincare", fact: "Dubai niche fragrance house; bilingual Arabic/English switcher resets cart items." },
  { name: "MaplePeak Gear", domain: "maplepeakgear.ca", country: "Canada", niche: "Outdoor & Sports", fact: "Outdoor camping equipment store; filter sidebar reloads entire page on every click." },
  { name: "Solstice Swim Sydney", domain: "solsticeswim.com.au", country: "Australia", niche: "Fashion & Apparel", fact: "Sustainable swimwear label; international currency selector does not update shipping threshold." },
  { name: "KlangWerk Berlin", domain: "klangwerk-audio.de", country: "Germany", niche: "Electronics & Gadgets", fact: "Studio synthesizer & modular gear shop; B2B dealer portal uses plain mailto links." },
  { name: "VelvetCrumb Roasters", domain: "velvetcrumbcoffee.com", country: "USA", niche: "Food & Beverage", fact: "Specialty coffee roaster; subscription cadence selector hidden below fold." },
  { name: "HarborLinen Co", domain: "harborlinenco.com", country: "USA", niche: "Home & Furniture", fact: "Organic bedding D2C store; bundle builder requires manual SKU matching." },
  { name: "KineticPulse Fitness", domain: "kineticpulsefit.co.uk", country: "United Kingdom", niche: "Outdoor & Sports", fact: "Home gym recovery equipment; comparison table overflows horizontally on tablet." },
  { name: "OasisHome Artisan", domain: "oasishomeartisan.ae", country: "UAE", niche: "Home & Furniture", fact: "Ceramic & tableware boutique; slow third-party tracking scripts delaying interactive state." },
];

export async function generateLedgerWorkbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Jayant Web & AI Systems";
  workbook.created = new Date("2026-10-01T10:00:00Z");

  // Sheet 1: Leads (200 rows, 18 columns)
  const leadsSheet = workbook.addWorksheet("Leads");
  const leadHeaders = [
    "Lead ID",
    "Discovery Date",
    "Market",
    "Country",
    "Business",
    "Niche",
    "Official Website",
    "Observed Fact (from site)",
    "Source URL",
    "Published Business Contact",
    "Contact Evidence URL",
    "Status",
    "Qualification Decision",
    "Outreach Approval",
    "Opt-Out",
    "Prior Contact Check",
    "Verification Level",
    "Notes",
  ];
  leadsSheet.addRow(leadHeaders);

  // Indices (1..200) that are directory-only (8 total: 4 India, 4 International)
  const directoryOnlyIndices = new Set([14, 38, 67, 92, 118, 143, 171, 195]);

  for (let i = 1; i <= 200; i++) {
    const isIndia = i <= 100;
    const isDirectoryOnly = directoryOnlyIndices.has(i);

    let leadId: string;
    let market: string;
    let country: string;
    let businessName: string;
    let niche: string;
    let website: string;
    let observedFact: string;
    let sourceUrl: string;
    let publishedContact: string;
    let contactEvidenceUrl: string;
    let verificationLevel: string;
    let notes: string;

    if (isIndia) {
      const seed = INDIA_BRANDS[(i - 1) % INDIA_BRANDS.length];
      const suffix = i <= 10 ? "" : ` ${Math.ceil(i / 10)}`;
      const slugNum = i <= 10 ? "" : `-${i}`;
      leadId = `ECOM-IN-${String(i).padStart(3, "0")}`;
      market = "India";
      country = "India";
      businessName = `${seed.name}${suffix}`;
      niche = seed.niche;
      const domain = seed.domain.replace(".in", `${slugNum}.in`).replace(".co.in", `${slugNum}.co.in`);
      website = isDirectoryOnly ? "" : `https://${domain}`;
      observedFact = isDirectoryOnly
        ? "Listed in D2C directory; official standalone storefront domain not yet verified."
        : seed.fact;
      sourceUrl = isDirectoryOnly
        ? `https://indiad2cdirectory.example.com/brands/${i}`
        : `https://${domain}/collections/all`;
      publishedContact = isDirectoryOnly
        ? ""
        : `contact@${domain}`;
      contactEvidenceUrl = isDirectoryOnly
        ? ""
        : `https://${domain}/pages/contact`;
      verificationLevel = isDirectoryOnly ? "directory listing only" : "site description";
      notes = isDirectoryOnly
        ? "Directory-only record requiring manual domain verification before qualification."
        : `India e-commerce prospect (${seed.city}) identified for web & conversion audit.`;
    } else {
      const intlIdx = i - 100;
      const seed = INTL_BRANDS[(intlIdx - 1) % INTL_BRANDS.length];
      const suffix = intlIdx <= 10 ? "" : ` ${Math.ceil(intlIdx / 10)}`;
      const slugNum = intlIdx <= 10 ? "" : `-${intlIdx}`;
      leadId = `ECOM-INTL-${String(intlIdx).padStart(3, "0")}`;
      market = "International";
      country = seed.country;
      businessName = `${seed.name}${suffix}`;
      niche = seed.niche;
      const dotIdx = seed.domain.indexOf(".");
      const domain = `${seed.domain.slice(0, dotIdx)}${slugNum}${seed.domain.slice(dotIdx)}`;
      website = isDirectoryOnly ? "" : `https://${domain}`;
      observedFact = isDirectoryOnly
        ? "Found in international retail trade directory; primary storefront URL unresolved."
        : seed.fact;
      sourceUrl = isDirectoryOnly
        ? `https://globalretailindex.example.org/entry/${intlIdx}`
        : `https://${domain}/about`;
      publishedContact = isDirectoryOnly
        ? ""
        : `hello@${domain}`;
      contactEvidenceUrl = isDirectoryOnly
        ? ""
        : `https://${domain}/contact`;
      verificationLevel = isDirectoryOnly ? "directory listing only" : "site description";
      notes = isDirectoryOnly
        ? "International directory-only entry; verify official domain before scoring."
        : `International e-commerce brand (${seed.country}) candidate for storefront & AI automation.`;
    }

    // Inject the exact anomalies noted in the Master Prompt (Section 0 & Section 13.5):
    // "I also found unexpected values in the Contact Evidence URL column, including 49 and sent."
    if (i === 49) {
      contactEvidenceUrl = "49";
    } else if (i === 112) {
      contactEvidenceUrl = "sent";
    }

    const discoveryDay = String(((i - 1) % 28) + 1).padStart(2, "0");
    const discoveryDate = `2026-09-${discoveryDay}`;

    leadsSheet.addRow([
      leadId,
      discoveryDate,
      market,
      country,
      businessName,
      niche,
      website,
      observedFact,
      sourceUrl,
      publishedContact,
      contactEvidenceUrl,
      "candidate",
      "not reviewed",
      "not approved",
      "unknown",
      "no prior contact",
      verificationLevel,
      notes,
    ]);
  }

  // Sheet 2: Run Log
  const runLogSheet = workbook.addWorksheet("Run Log");
  runLogSheet.addRow([
    "Run Date",
    "India Candidates",
    "International Candidates",
    "Total Candidates",
    "Official Website Observed",
    "Directory-Only Unresolved",
    "Duplicate Domains Within Run",
    "Cross-Run Duplicate Check",
    "Messages Sent",
    "Qualification Status",
    "Notes",
  ]);
  runLogSheet.addRow([
    "2026-09-30",
    100,
    100,
    200,
    192,
    8,
    0,
    "Passed (0 cross-run collisions)",
    0,
    "All 200 marked not reviewed / not approved",
    "Initial Global E-Commerce Lead Ledger (2026) collection run. 192 verified via site description, 8 directory-only entries require domain verification.",
  ]);

  // Sheet 3: Do Not Contact (headers only, per Section 0 & Section 13.7)
  const dncSheet = workbook.addWorksheet("Do Not Contact");
  dncSheet.addRow([
    "Business / Domain",
    "Contact / Channel",
    "Opt-Out Date",
    "Reason / Source",
    "Do Not Contact Status",
    "Notes",
  ]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function ensureLedgerFixtureOnDisk(): Promise<string> {
  const fixturesDir = path.resolve(process.cwd(), "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  const targetPath = path.join(fixturesDir, LEDGER_FILENAME);
  if (!fs.existsSync(targetPath)) {
    const buf = await generateLedgerWorkbookBuffer();
    fs.writeFileSync(targetPath, buf);
  }
  return targetPath;
}
