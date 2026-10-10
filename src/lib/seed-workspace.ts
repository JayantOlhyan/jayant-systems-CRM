import { eq } from "drizzle-orm";
import {
  getDb,
  DEFAULT_WORKSPACE_ID,
  DEFAULT_PIPELINE_ID,
  GLOBAL_ECOM_COLLECTION_ID,
  DEFAULT_SCORING_CONFIG,
} from "@/db";
import {
  organizations,
  collections,
  categories,
  fieldDefinitions,
  opportunities,
  contacts,
  tasks,
  notes,
  referencesLibrary,
  contentIdeas,
  activities,
} from "@/db/schema";
import { generateLedgerWorkbookBuffer, LEDGER_FILENAME, ensureLedgerFixtureOnDisk } from "./ledger-fixture";
import { parseWorkbookSheets, executeSpreadsheetImport } from "./importer";

export async function ensureWorkspaceSeeded(workspaceId = DEFAULT_WORKSPACE_ID) {
  const db = await getDb();
  const existingOrgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId));

  if (existingOrgs.length > 0) {
    return { seeded: false, leadCount: existingOrgs.length };
  }

  // 1. Ensure the .xlsx fixture exists on disk and import the 200-lead Global E-Commerce Lead Ledger
  await ensureLedgerFixtureOnDisk();
  const buffer = await generateLedgerWorkbookBuffer();
  const { inspection } = await parseWorkbookSheets(buffer, LEDGER_FILENAME);
  const leadsSheet = inspection.sheets.find((s) => s.name === "Leads")!;

  await executeSpreadsheetImport({
    buffer,
    filename: LEDGER_FILENAME,
    selectedSheet: "Leads",
    collectionId: GLOBAL_ECOM_COLLECTION_ID,
    mapping: leadsSheet.suggestedMapping,
    workspaceId,
  });

  // 2. Create additional collections demonstrating multi-collection custom fields & categories (Section 7)
  const extraCollections = [
    {
      id: "col_web_dev",
      name: "Website Development Leads",
      slug: "website-development-leads",
      description: "High-impact redesign, conversion optimization, and headless storefront prospects",
      icon: "Globe",
      color: "#659BFA",
      recordType: "company",
      defaultView: "kanban",
      sortOrder: 2,
      cats: ["Storefront Redesign", "Speed & Core Web Vitals", "Custom Web App", "Landing Page"],
      fields: [
        {
          id: "fld_web_cms",
          name: "Current Tech Stack / CMS",
          key: "current_cms",
          fieldType: "single_select",
          options: ["Shopify", "WooCommerce", "Custom / Next.js", "Magento", "Wix", "Unknown"],
        },
        {
          id: "fld_web_lcp",
          name: "Mobile Speed Rating",
          key: "mobile_speed_rating",
          fieldType: "rating",
          options: [],
        },
      ],
    },
    {
      id: "col_schools",
      name: "School & College Leads",
      slug: "school-college-leads",
      description: "Educational institutions needing modern admission portals, CMS, and parent dashboards",
      icon: "GraduationCap",
      color: "#32B881",
      recordType: "company",
      defaultView: "table",
      sortOrder: 3,
      cats: ["K-12 School", "Higher Education / College", "Coaching Institute", "Preschool"],
      fields: [
        {
          id: "fld_sch_type",
          name: "Institution Type",
          key: "institution_type",
          fieldType: "single_select",
          options: ["CBSE / ICSE School", "International School", "University / College", "EdTech"],
        },
        {
          id: "fld_sch_admissions",
          name: "Admissions Portal Active",
          key: "admissions_portal_active",
          fieldType: "checkbox",
          options: [],
        },
      ],
    },
    {
      id: "col_ai_automation",
      name: "AI & Automation Leads",
      slug: "ai-automation-leads",
      description: "Businesses suited for AI customer support, workflow automation, and CRM integrations",
      icon: "Bot",
      color: "#E9AE50",
      recordType: "company",
      defaultView: "table",
      sortOrder: 4,
      cats: ["AI Support Agent", "WhatsApp Commerce Flow", "Internal Ops Automation"],
      fields: [
        {
          id: "fld_ai_usecase",
          name: "Primary Automation Use Case",
          key: "automation_use_case",
          fieldType: "text",
          options: [],
        },
      ],
    },
    {
      id: "col_social_reels",
      name: "Social Media / Good Reels",
      slug: "social-media-good-reels",
      description: "Websites and brands flagged for Instagram Reels / YouTube Shorts teardown & case studies",
      icon: "Video",
      color: "#EC4899",
      recordType: "reference",
      defaultView: "cards",
      sortOrder: 5,
      cats: ["Good Reel", "For Reference", "Good, Need to Work With It"],
      fields: [],
    },
  ];

  for (const col of extraCollections) {
    const existing = await db.select().from(collections).where(eq(collections.id, col.id));
    if (existing.length === 0) {
      await db.insert(collections).values({
        id: col.id,
        workspaceId,
        name: col.name,
        slug: col.slug,
        description: col.description,
        icon: col.icon,
        color: col.color,
        recordType: col.recordType,
        defaultView: col.defaultView,
        defaultPipelineId: DEFAULT_PIPELINE_ID,
        scoringConfig: DEFAULT_SCORING_CONFIG,
        isPinned: true,
        isVisibleInSidebar: true,
        sortOrder: col.sortOrder,
      });

      let cOrder = 1;
      for (const cName of col.cats) {
        await db.insert(categories).values({
          id: `cat_${col.id}_${cOrder}`,
          workspaceId,
          collectionId: col.id,
          name: cName,
          color: col.color,
          sortOrder: cOrder++,
        });
      }

      let fOrder = 1;
      for (const f of col.fields) {
        await db.insert(fieldDefinitions).values({
          id: f.id,
          workspaceId,
          collectionId: col.id,
          name: f.name,
          key: f.key,
          fieldType: f.fieldType,
          isRequired: false,
          isVisible: true,
          sortOrder: fOrder++,
          options: f.options,
        });
      }
    }
  }

  // 3. Fetch the first few imported organizations to link realistic opportunities, tasks, notes, references, and content ideas
  const importedOrgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId));

  const org1 = importedOrgs.find((o) => o.externalId === "ECOM-IN-001") || importedOrgs[0];
  const org2 = importedOrgs.find((o) => o.externalId === "ECOM-IN-002") || importedOrgs[1];
  const org3 = importedOrgs.find((o) => o.externalId === "ECOM-IN-003") || importedOrgs[2];
  const orgIntl1 = importedOrgs.find((o) => o.externalId === "ECOM-INTL-001") || importedOrgs[100];
  const orgDirOnly = importedOrgs.find((o) => o.verificationLevel === "directory listing only") || importedOrgs[13];

  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const nextWeekStr = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];

  if (org1 && org2 && org3 && orgIntl1) {
    // Contacts
    await db.insert(contacts).values([
      {
        id: "cnt_apex_founder",
        workspaceId,
        organizationId: org1.id,
        fullName: "Rohan Mehta",
        jobTitle: "Founder & Managing Director",
        department: "Executive",
        email: org1.publishedContact || "contact@apexfurniture.in",
        phone: "+91 98110 45210",
        linkedinUrl: "https://linkedin.com/in/rohan-mehta-apex",
        preferredChannel: "Email",
        country: "India",
        city: "Delhi",
        tags: ["Decision Maker", "D2C Founder"],
        approvalStatus: "not approved",
        notes: "Published business contact from official website footer.",
      },
      {
        id: "cnt_vedaglow_head",
        workspaceId,
        organizationId: org2.id,
        fullName: "Ananya Iyer",
        jobTitle: "Head of E-Commerce & Digital",
        department: "Growth",
        email: org2.publishedContact || "contact@vedaglownaturals.in",
        country: "India",
        city: "Mumbai",
        tags: ["E-Commerce Lead"],
        approvalStatus: "not approved",
      },
      {
        id: "cnt_nordic_ops",
        workspaceId,
        organizationId: orgIntl1.id,
        fullName: "Erik Lindqvist",
        jobTitle: "Director of Digital Storefront",
        department: "Operations",
        email: orgIntl1.publishedContact || "hello@nordictimberliving.com",
        country: "USA",
        tags: ["International Prospect"],
        approvalStatus: "not approved",
      },
    ]);

    // Multiple opportunities (including 2 on the same company to demonstrate 1-to-many opportunities per Section 7.3 & 15.4)
    await db.insert(opportunities).values([
      {
        id: "opp_apex_redesign",
        workspaceId,
        organizationId: org1.id,
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        primaryContactId: "cnt_apex_founder",
        name: "Apex Storefront UX & Speed Overhaul",
        serviceType: "Website Redesign & Speed Optimization",
        description: "Full product gallery refactor, mobile LCP optimization, and 1-click cart drawer.",
        pipelineId: DEFAULT_PIPELINE_ID,
        stageId: "stg_researching",
        estimatedValue: "185000",
        currency: "INR",
        probability: 60,
        priority: "high",
        expectedCloseDate: nextWeekStr,
        nextAction: "Complete technical speed & UX audit deck",
        outcome: "open",
      },
      {
        id: "opp_apex_ai_assistant",
        workspaceId,
        organizationId: org1.id,
        collectionId: "col_ai_automation",
        primaryContactId: "cnt_apex_founder",
        name: "Apex Custom Woodwork AI Quote Concierge",
        serviceType: "AI Automation & Chatbot",
        description: "Interactive AI dimension & wood-finish estimator integrated with WhatsApp.",
        pipelineId: DEFAULT_PIPELINE_ID,
        stageId: "stg_new",
        estimatedValue: "95000",
        currency: "INR",
        probability: 40,
        priority: "medium",
        expectedCloseDate: nextWeekStr,
        nextAction: "Scope SKU catalog schema for quote calculator",
        outcome: "open",
      },
      {
        id: "opp_vedaglow_checkout",
        workspaceId,
        organizationId: org2.id,
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        primaryContactId: "cnt_vedaglow_head",
        name: "VedaGlow Checkout Conversion & Sticky Cart",
        serviceType: "Conversion Rate Optimization",
        description: "Streamline 4-step checkout and add recurring replenishment subscription toggle.",
        pipelineId: DEFAULT_PIPELINE_ID,
        stageId: "stg_qualified",
        estimatedValue: "140000",
        currency: "INR",
        probability: 75,
        priority: "high",
        expectedCloseDate: tomorrowStr,
        nextAction: "Review checkout funnel drop-off points",
        outcome: "open",
      },
      {
        id: "opp_nordic_configurator",
        workspaceId,
        organizationId: orgIntl1.id,
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        primaryContactId: "cnt_nordic_ops",
        name: "NordicTimber 3D Room Preview & Quote Builder",
        serviceType: "Custom Web Application",
        description: "Interactive table size configurator and instant shipping estimator.",
        pipelineId: DEFAULT_PIPELINE_ID,
        stageId: "stg_proposal",
        estimatedValue: null, // Explicitly null estimated value per Section 6.2 ("show as unknown instead of 0")
        currency: "INR",
        probability: 50,
        priority: "high",
        expectedCloseDate: nextWeekStr,
        nextAction: "Determine commercial scope & budget range",
        outcome: "open",
      },
    ]);

    // Tasks & Follow-ups (Overdue, Today, Tomorrow, Next 7 Days)
    await db.insert(tasks).values([
      {
        id: "tsk_audit_apex",
        workspaceId,
        title: "Audit Apex Furniture mobile product gallery & Core Web Vitals",
        description: "Measure LCP on product pages and record 3-minute Loom breakdown.",
        taskType: "Research",
        organizationId: org1.id,
        opportunityId: "opp_apex_redesign",
        contactId: "cnt_apex_founder",
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        priority: "high",
        status: "To Do",
        dueDate: todayStr,
        dueTime: "11:00",
        reminderSetting: "day_of",
      },
      {
        id: "tsk_verify_dironly",
        workspaceId,
        title: `Verify official domain for directory-only lead (${orgDirOnly?.name || "ECOM-IN-014"})`,
        description: "Record was imported with 'directory listing only' verification. Confirm official website before qualification.",
        taskType: "Research",
        organizationId: orgDirOnly?.id || org3.id,
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        priority: "high",
        status: "To Do",
        dueDate: yesterdayStr, // Overdue task for Today's Priorities
        dueTime: "16:00",
        reminderSetting: "day_of",
      },
      {
        id: "tsk_vedaglow_ux",
        workspaceId,
        title: "Prepare checkout conversion teardown for VedaGlow Naturals",
        description: "Document the 4-reload checkout bottleneck and sticky cart wireframe.",
        taskType: "Proposal",
        organizationId: org2.id,
        opportunityId: "opp_vedaglow_checkout",
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        priority: "medium",
        status: "In Progress",
        dueDate: todayStr,
        dueTime: "15:30",
        reminderSetting: "1_hour_before",
      },
      {
        id: "tsk_nordic_scope",
        workspaceId,
        title: "Follow up on NordicTimber Living configurator requirements",
        description: "Review custom oak finishes matrix and shipping zones.",
        taskType: "Follow-up",
        organizationId: orgIntl1.id,
        opportunityId: "opp_nordic_configurator",
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        priority: "medium",
        status: "To Do",
        dueDate: tomorrowStr,
        dueTime: "10:00",
        reminderSetting: "day_of",
      },
      {
        id: "tsk_kalavastra_reel",
        workspaceId,
        title: "Script UX teardown reel for handloom D2C checkout flow",
        description: "Highlight how size-guide modals and WhatsApp updates reduce RTO.",
        taskType: "Content",
        organizationId: org3.id,
        collectionId: "col_social_reels",
        priority: "low",
        status: "To Do",
        dueDate: nextWeekStr,
        dueTime: "14:00",
        reminderSetting: "none",
      },
    ]);

    // Notes
    await db.insert(notes).values([
      {
        id: "note_apex_1",
        workspaceId,
        organizationId: org1.id,
        opportunityId: "opp_apex_redesign",
        content:
          "Observed from site inspection: Apex Furniture Studio has strong product photography across 140+ solid wood SKUs, but mobile product pages load unoptimized 4MB images and lack a sticky Add-to-Cart bar. High potential for a headless/Shopify theme speed overhaul.",
        isPinned: true,
        origin: "user",
      },
      {
        id: "note_vedaglow_1",
        workspaceId,
        organizationId: org2.id,
        content:
          "VedaGlow Naturals runs active seasonal bundles but forces visitors through 4 full page reloads before payment options appear.",
        isPinned: false,
        origin: "user",
      },
    ]);

    // Reference Library items (Section 18)
    await db.insert(referencesLibrary).values([
      {
        id: "ref_shopify_checkout",
        workspaceId,
        title: "High-Converting Slide-Out Cart Drawer with Tiered Free Shipping Bar",
        url: "https://apexfurniture.in/collections/all",
        description: "Reference benchmark for D2C furniture & home decor slide-out cart upsells and trust badges.",
        category: "Good Website Design",
        tags: ["Shopify", "Cart UX", "D2C Conversion"],
        organizationId: org1.id,
        opportunityId: "opp_apex_redesign",
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        notes: "Use this layout pattern when presenting the redesign mockup to Apex Furniture Studio.",
      },
      {
        id: "ref_d2c_reel_example",
        workspaceId,
        title: "3 E-Commerce Checkout Mistakes Costing Indian D2C Brands 30% Conversions",
        url: "https://vedaglownaturals.in",
        description: "Visual example of multi-reload checkout friction vs single-page express checkout.",
        category: "Good Reel",
        tags: ["Good Reel", "UX Audit", "Instagram Hook"],
        organizationId: org2.id,
        collectionId: "col_social_reels",
        notes: "Great before/after visual contrast for an educational agency reel.",
      },
      {
        id: "ref_b2b_configurator",
        workspaceId,
        title: "Interactive Custom Dimension & Finish Price Calculator",
        url: "https://nordictimberliving.com",
        description: "Clean architectural UI for configuring custom timber dimensions without leaving the product page.",
        category: "Good, Need to Work With It",
        tags: ["Interactive UI", "3D Configurator", "Furniture"],
        organizationId: orgIntl1.id,
        opportunityId: "opp_nordic_configurator",
        collectionId: "col_web_dev",
      },
    ]);

    // Content Ideas (Section 19)
    await db.insert(contentIdeas).values([
      {
        id: "cid_d2c_checkout",
        workspaceId,
        title: "Why D2C Skincare Brands Lose Mobile Buyers at Step 2 of Checkout",
        hook: "Stop forcing your mobile shoppers through 4 page reloads just to see shipping costs.",
        description: "Walkthrough based on observed site facts from VedaGlow Naturals showing how a slide-out cart drawer + UPI express checkout lifts conversion.",
        platform: "Instagram Reels",
        contentType: "UX Teardown / Redesign Concept",
        organizationId: org2.id,
        referenceId: "ref_d2c_reel_example",
        category: "Good Reel",
        priority: "high",
        status: "Scripting",
        targetPublicationDate: tomorrowStr,
        notes: "Keep strictly factual based on observed checkout reload latency.",
      },
      {
        id: "cid_furniture_lcp",
        workspaceId,
        title: "Fixing 6-Second Load Times on High-Ticket Furniture Storefronts",
        hook: "High-resolution wood grain photos shouldn't make your mobile store unusable.",
        description: "Technical breakdown of AVIF image pipelines, responsive srcset, and sticky mobile spec drawers for furniture brands.",
        platform: "LinkedIn",
        contentType: "Case Study / Technical Breakdown",
        organizationId: org1.id,
        referenceId: "ref_shopify_checkout",
        category: "Good Website Design",
        priority: "medium",
        status: "Idea",
        targetPublicationDate: nextWeekStr,
      },
    ]);

    await db.insert(activities).values([
      {
        id: "act_seed_opp",
        workspaceId,
        organizationId: org1.id,
        opportunityId: "opp_apex_redesign",
        actorOrigin: "user",
        activityType: "opportunity_created",
        title: "Opportunity created: Apex Storefront UX & Speed Overhaul (₹1,85,000)",
      },
      {
        id: "act_seed_task",
        workspaceId,
        organizationId: org1.id,
        actorOrigin: "user",
        activityType: "followup_scheduled",
        title: "Task scheduled: Audit Apex Furniture mobile product gallery",
      },
    ]);
  }

  return { seeded: true, leadCount: 200 };
}
