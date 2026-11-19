/* Bookslab seed — an original catalog of Indian law, finance & tax, academic, tech and general titles (₹ INR).
   Titles are published under Bookslab's own imprints with fictional authors; ISBNs are
   checksum-valid but fictional (978-93 India prefix). Cover images are generated as SVG
   files in public/uploads/books so every book has a real, servable cover. */
import { mkdir, readdir, unlink, writeFile } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { connectDB } from "./mongo";
import { ActivitySession, Book, BookRequest, ContactMessage, Drop, Order, SearchEvent, SecurityLog, SiteContent, StoreSettings, User, type BookDoc } from "./models";
import { coverSvg } from "./cover-svg";

type Seed = {
  title: string; subtitle?: string; author: string; publisher: string; category: "Law" | "Finance & Tax" | "Academic" | "Tech & Management" | "General";
  sub: string; format?: "Paperback" | "Hardcover" | "E-book" | "Subscription"; mrp: number; price: number; edition: string; year: number;
  pages: number; stock: number; rating: number; reviews: number; description: string; tags: string[]; featured?: boolean; slug?: string;
};

const BOOKS: Seed[] = [
  // ───────── Law ─────────
  { title: "Bharatiya Nyaya Sanhita, 2023", subtitle: "Bare Act with IPC Concordance & Short Notes", author: "Bookslab Legal Editorial Board", publisher: "Bookslab Legal", category: "Law", sub: "Bare Acts", mrp: 395, price: 335, edition: "3rd Edition", year: 2026, pages: 248, stock: 180, rating: 4.8, reviews: 1284, description: "The complete text of the BNS, 2023 with a section-by-section concordance to the IPC, 1860, marginal notes and a ready index of offences.", tags: ["BNS", "criminal law", "bare act", "IPC"], featured: true },
  { title: "Bharatiya Nagarik Suraksha Sanhita, 2023", subtitle: "Bare Act with CrPC Comparison Tables", author: "Bookslab Legal Editorial Board", publisher: "Bookslab Legal", category: "Law", sub: "Bare Acts", mrp: 495, price: 420, edition: "3rd Edition", year: 2026, pages: 372, stock: 140, rating: 4.7, reviews: 932, description: "Full text of the BNSS with comparative tables mapping every provision to the CrPC, 1973, the Schedules and prescribed forms.", tags: ["BNSS", "criminal procedure", "bare act", "CrPC"], featured: true },
  { title: "Bharatiya Sakshya Adhiniyam, 2023", subtitle: "Bare Act with Evidence Act Concordance", author: "Bookslab Legal Editorial Board", publisher: "Bookslab Legal", category: "Law", sub: "Bare Acts", mrp: 295, price: 250, edition: "2nd Edition", year: 2026, pages: 132, stock: 160, rating: 4.7, reviews: 611, description: "The BSA, 2023 with section mapping to the Indian Evidence Act, 1872 and notes on electronic records, presumptions and burden of proof.", tags: ["BSA", "evidence", "bare act"] },
  { title: "The Constitution of India", subtitle: "Pocket Edition — Amended up to 2026", author: "Bookslab Legal Editorial Board", publisher: "Bookslab Legal", category: "Law", sub: "Constitutional Law", mrp: 350, price: 299, edition: "Pocket 2026", year: 2026, pages: 516, stock: 220, rating: 4.9, reviews: 2210, description: "A coat-pocket Constitution with all amendments, Schedules and a subject index, printed on 40 GSM bible paper with a ribbon marker.", tags: ["constitution", "pocket", "judiciary", "CLAT"], featured: true },
  { title: "Constitutional Law of India", subtitle: "A Critical Commentary", author: "Adv. Meera Kaul", publisher: "Bookslab Legal", category: "Law", sub: "Constitutional Law", format: "Hardcover", mrp: 1495, price: 1195, edition: "5th Edition", year: 2026, pages: 1120, stock: 45, rating: 4.6, reviews: 214, description: "Article-wise commentary with landmark judgments, written for judiciary aspirants and practitioners alike.", tags: ["constitution", "commentary", "judiciary"] },
  { title: "AIBE XX Solved Papers & Mock Tests", subtitle: "All India Bar Examination — 2026 Pattern", author: "Ritika Sehgal & Aman Joshi", publisher: "Bookslab Academic", category: "Law", sub: "AIBE", mrp: 650, price: 499, edition: "2026 Edition", year: 2026, pages: 540, stock: 210, rating: 4.5, reviews: 776, description: "Ten previous AIBE papers solved with explanations, five full-length mocks on the BNS/BNSS/BSA pattern and an open-book strategy guide.", tags: ["AIBE", "bar exam", "solved papers", "mock tests"], featured: true },
  { title: "Delhi Judicial Services Guide", subtitle: "Prelims + Mains — Solved Papers 2007–2025", author: "Justice (Retd.) S. K. Malhotra", publisher: "Bookslab Academic", category: "Law", sub: "Judicial Services", mrp: 1250, price: 995, edition: "4th Edition", year: 2026, pages: 880, stock: 70, rating: 4.6, reviews: 341, description: "Topic-wise solved DJS papers, model answers for Mains, judgment-writing drills and a viva-voce question bank.", tags: ["judiciary", "DJS", "solved papers"] },
  { title: "Law of Contract & Specific Relief", author: "Prof. Arvind Rao", publisher: "Bookslab Legal", category: "Law", sub: "Civil Law", mrp: 895, price: 745, edition: "8th Edition", year: 2025, pages: 690, stock: 85, rating: 4.5, reviews: 402, description: "The LL.B. classic on the Indian Contract Act, 1872 and the Specific Relief Act, 1963, with problem questions and amendment analysis.", tags: ["contract", "LLB", "civil law"] },
  { title: "Code of Civil Procedure", subtitle: "Student Edition with Orders & Rules", author: "Adv. Kunal Bhatia", publisher: "Bookslab Legal", category: "Law", sub: "Civil Law", mrp: 795, price: 675, edition: "6th Edition", year: 2026, pages: 760, stock: 34, rating: 4.4, reviews: 198, description: "Sections and Orders explained with flowcharts of a civil suit from plaint to execution, plus commercial courts amendments.", tags: ["CPC", "civil procedure", "LLB"] },
  // ───────── Academic (CA / CS / CMA) ─────────
  { title: "CA Foundation: Accounting", subtitle: "Principles & Practice — Sept 2026 Attempt", author: "CA Nitin Arora", publisher: "Bookslab Academic", category: "Academic", sub: "CA Foundation", mrp: 895, price: 760, edition: "2026 Edition", year: 2026, pages: 812, stock: 150, rating: 4.7, reviews: 1033, description: "ICAI-aligned theory, 600+ illustrations and chapter-wise past-paper questions for the new scheme of CA Foundation.", tags: ["CA Foundation", "accounting", "ICAI"], featured: true },
  { title: "CA Foundation: Business Laws", subtitle: "Quick Revision Charts & MCQs", author: "CA Sneha Gupta", publisher: "Bookslab Academic", category: "Academic", sub: "CA Foundation", mrp: 595, price: 495, edition: "2026 Edition", year: 2026, pages: 360, stock: 120, rating: 4.6, reviews: 588, description: "One-page charts for every chapter of Business Laws and 400 MCQs with answers.", tags: ["CA Foundation", "business laws", "MCQ"] },
  { title: "CA Intermediate: Taxation", subtitle: "Income Tax + GST — AY 2027-28", author: "CA Vikram Sood & CA Pooja Nair", publisher: "Bookslab Academic", category: "Academic", sub: "CA Intermediate", mrp: 1495, price: 1245, edition: "2026-27 Edition", year: 2026, pages: 1180, stock: 95, rating: 4.8, reviews: 1421, description: "Concept-first Income Tax and GST for CA Inter with Finance Act amendments, 900 practice questions and RTP/MTP mapping.", tags: ["CA Inter", "taxation", "GST", "income tax"], featured: true },
  { title: "CA Intermediate: Advanced Accounting", subtitle: "Practice Manual", author: "CA Rohit Bansal", publisher: "Bookslab Academic", category: "Academic", sub: "CA Intermediate", mrp: 1295, price: 1095, edition: "2026 Edition", year: 2026, pages: 940, stock: 60, rating: 4.5, reviews: 377, description: "Standard-wise solved problems, amalgamation and branch-accounts drills and full-length tests with step marking.", tags: ["CA Inter", "advanced accounting"] },
  { title: "CA Final: Direct Tax Laws Scanner", subtitle: "Topic-wise Past Papers — Nov 2026", author: "CA Vikram Sood", publisher: "Bookslab Academic", category: "Academic", sub: "CA Final", mrp: 1095, price: 899, edition: "Nov 2026 Edition", year: 2026, pages: 720, stock: 110, rating: 4.7, reviews: 856, description: "Every DT and International Tax question from the last 12 attempts, solved under the latest law.", tags: ["CA Final", "direct tax", "scanner"] },
  { title: "CA Final: Financial Reporting", subtitle: "Ind AS Made Visual", author: "CA Ananya Mehra", publisher: "Bookslab Academic", category: "Academic", sub: "CA Final", mrp: 1695, price: 1395, edition: "2026 Edition", year: 2026, pages: 1060, stock: 28, rating: 4.6, reviews: 412, description: "Ind AS through flowcharts, journal-entry maps and case studies for the case-scenario based FR paper.", tags: ["CA Final", "Ind AS", "FR"] },
  { title: "CS Executive: Company Law & Practice", author: "CS Harsh Vardhan", publisher: "Bookslab Academic", category: "Academic", sub: "CS Executive", mrp: 995, price: 845, edition: "2026 Edition", year: 2026, pages: 680, stock: 55, rating: 4.5, reviews: 233, description: "ICSI syllabus coverage of the Companies Act, 2013 with secretarial practice notes and case laws.", tags: ["CS", "company law", "ICSI"] },
  { title: "CMA Intermediate: Cost Accounting", subtitle: "MCQ & Practice Bank", author: "CMA Deepak Iyer", publisher: "Bookslab Academic", category: "Academic", sub: "CMA Intermediate", mrp: 695, price: 575, edition: "2026 Edition", year: 2026, pages: 480, stock: 72, rating: 4.4, reviews: 164, description: "1,200 MCQs and 300 numericals across costing methods, CAS standards and standard costing.", tags: ["CMA", "cost accounting", "MCQ"] },
  // ───────── Finance & Tax ─────────
  { title: "The 2026 Ultimate Legal & Tax Compendium", subtitle: "GST • Income Tax • Customs • Companies • BNS", author: "Bookslab Editorial Board", publisher: "Bookslab Press", category: "Finance & Tax", sub: "Compendium", format: "Hardcover", mrp: 2995, price: 2495, edition: "Flagship 2026", year: 2026, pages: 1840, stock: 260, rating: 4.9, reviews: 318, description: "Bookslab's flagship: every major Indian tax and corporate statute in one lay-flat volume with companion notes, colour thumb tabs and a 48-page revision index.", tags: ["compendium", "GST", "income tax", "customs", "BNS", "flagship"], featured: true, slug: "ultimate-legal-tax-compendium-2026" },
  { title: "GST Ready Reckoner 2026", subtitle: "Law, Rates, Returns & Procedures", author: "CA Rajeev Khanna", publisher: "Bookslab Press", category: "Finance & Tax", sub: "GST", mrp: 2295, price: 1895, edition: "21st Edition", year: 2026, pages: 1420, stock: 130, rating: 4.8, reviews: 1690, description: "The practitioner's desk reference for GST: rate tables, HSN/SAC lookups, return-filing flowcharts and e-invoicing.", tags: ["GST", "practitioner", "reckoner", "HSN"], featured: true },
  { title: "Income-tax Act, 2025", subtitle: "Bare Act with Rules & 1961 Act Concordance", author: "Bookslab Tax Editorial Board", publisher: "Bookslab Press", category: "Finance & Tax", sub: "Income Tax", mrp: 1795, price: 1495, edition: "1st Edition", year: 2026, pages: 1280, stock: 115, rating: 4.7, reviews: 540, description: "The new Income-tax Act, 2025 with Rules, forms and a full concordance to the 1961 Act.", tags: ["income tax", "bare act", "2025 act"], featured: true },
  { title: "Customs Law Manual 2026-27", author: "R. S. Chawla", publisher: "Bookslab Press", category: "Finance & Tax", sub: "Customs", mrp: 2695, price: 2295, edition: "2026-27 Edition", year: 2026, pages: 1650, stock: 38, rating: 4.6, reviews: 207, description: "The Customs Act, 1962, Customs Tariff Act, rules, regulations and notifications with practitioner notes on valuation.", tags: ["customs", "foreign trade", "valuation"] },
  { title: "Companies Act, 2013 with Rules", subtitle: "Pocket Edition", author: "Bookslab Corporate Editorial Board", publisher: "Bookslab Press", category: "Finance & Tax", sub: "Corporate Law", mrp: 1295, price: 1095, edition: "2026 Pocket", year: 2026, pages: 1340, stock: 90, rating: 4.6, reviews: 389, description: "Act, Rules and Schedules in a compact pocket format with a topical index for board meetings, CSR and NCLT procedure.", tags: ["companies act", "corporate law", "pocket", "CS"] },
  { title: "Transfer Pricing Simplified", subtitle: "Indian Rules, OECD Guidelines & Case Studies", author: "CA Farah Siddiqui", publisher: "Bookslab Press", category: "Finance & Tax", sub: "International Tax", mrp: 1495, price: 1250, edition: "3rd Edition", year: 2025, pages: 620, stock: 32, rating: 4.5, reviews: 121, description: "Methods, benchmarking, safe harbour and APA practice explained through 40 case studies.", tags: ["transfer pricing", "international tax", "OECD"] },
  { title: "TDS & TCS Practitioner's Handbook", author: "CA Manish Taneja", publisher: "Bookslab Press", category: "Finance & Tax", sub: "Income Tax", mrp: 995, price: 845, edition: "2026 Edition", year: 2026, pages: 540, stock: 76, rating: 4.4, reviews: 266, description: "Section-wise TDS/TCS rates, a compliance calendar, return walkthroughs and default & penalty charts.", tags: ["TDS", "TCS", "compliance"] },
  // ───────── Tech & Management ─────────
  { title: "Applied GenAI for Indian Enterprises", subtitle: "From Prompt to Production", author: "Ishaan Malhotra", publisher: "Bookslab Tech", category: "Tech & Management", sub: "AI & ML", mrp: 899, price: 699, edition: "1st Edition", year: 2026, pages: 410, stock: 140, rating: 4.7, reviews: 512, description: "Retrieval, agents, evaluation and governance for AI products built for Indian languages, payments and compliance.", tags: ["AI", "LLM", "GenAI", "enterprise"], featured: true },
  { title: "System Design for the Next Billion Users", author: "Kavya Reddy", publisher: "Bookslab Tech", category: "Tech & Management", sub: "Software Engineering", mrp: 799, price: 649, edition: "2nd Edition", year: 2026, pages: 380, stock: 88, rating: 4.6, reviews: 344, description: "Designing for low-bandwidth, multilingual, UPI-scale systems — caching, queues, offline-first and cost-aware architecture.", tags: ["system design", "interviews", "architecture"] },
  { title: "Data Science with Python", subtitle: "Indian Case Studies", author: "Dr. Neha Kapoor", publisher: "Bookslab Tech", category: "Tech & Management", sub: "Data Science", mrp: 749, price: 599, edition: "3rd Edition", year: 2025, pages: 450, stock: 66, rating: 4.5, reviews: 287, description: "pandas, scikit-learn and visualisation through datasets from Indian railways, monsoon records and GST collections.", tags: ["python", "data science", "ML"] },
  { title: "Prompt to Product", subtitle: "Shipping AI Apps in a Weekend", author: "Arjun Mehta", publisher: "Bookslab Tech", category: "Tech & Management", sub: "AI & ML", mrp: 599, price: 479, edition: "1st Edition", year: 2026, pages: 260, stock: 120, rating: 4.4, reviews: 190, description: "A hands-on build book: ideation, UX, APIs, evals and launch for small AI products.", tags: ["AI", "startups", "product"] },
  { title: "Bookslab Pro Reader Pass", subtitle: "12 months • 1,500+ e-books & bare acts", author: "Bookslab Digital", publisher: "Bookslab Digital", category: "Tech & Management", sub: "Subscription", format: "Subscription", mrp: 2999, price: 1999, edition: "Annual Plan", year: 2026, pages: 0, stock: 9999, rating: 4.8, reviews: 920, description: "Unlimited reading across Bookslab's law, tax and CA library on web and mobile, with synced highlights and monthly amendment updates.", tags: ["subscription", "e-books", "reader pass"] },
  { title: "TaxDesk GST Filing Suite", subtitle: "1-Year Licence • up to 50 GSTINs", author: "Bookslab Digital", publisher: "Bookslab Digital", category: "Tech & Management", sub: "Tax Software", format: "Subscription", mrp: 4999, price: 3999, edition: "2026-27 Licence", year: 2026, pages: 0, stock: 9999, rating: 4.6, reviews: 288, description: "GSTR-1/3B/9 preparation, 2B reconciliation, e-invoice and e-way bill generation for practitioners.", tags: ["GST", "software", "filing"] },
  { title: "CA Final Complete E-Book Bundle", subtitle: "All 6 papers • Nov 2026", author: "Bookslab Academic", publisher: "Bookslab Digital", category: "Academic", sub: "E-Book", format: "E-book", mrp: 2999, price: 2199, edition: "Nov 2026", year: 2026, pages: 5200, stock: 9999, rating: 4.6, reviews: 402, description: "Instant access to all six CA Final paper e-books with offline reading, search and highlight sync.", tags: ["e-book", "CA Final", "bundle"] },
  { title: "Managing a Professional Firm", subtitle: "People, Pricing & Practice for Indian CA and Law Firms", author: "Shalini Dutta", publisher: "Bookslab Press", category: "Tech & Management", sub: "Management", mrp: 695, price: 575, edition: "1st Edition", year: 2026, pages: 300, stock: 64, rating: 4.4, reviews: 118, description: "A practical handbook on hiring, billing, client care and partnership structure for small and mid-sized professional firms in India.", tags: ["management", "practice", "firm", "leadership"] },
  // ───────── General ─────────
  { title: "Writing Clearly at Work", subtitle: "Plain English for Lawyers, Accountants & Managers", author: "Nandini Rao", publisher: "Bookslab Press", category: "General", sub: "Writing", mrp: 450, price: 380, edition: "2nd Edition", year: 2026, pages: 220, stock: 110, rating: 4.7, reviews: 389, description: "Short, practical chapters on drafting emails, opinions, reports and notices that are easy to read — with before-and-after examples from Indian offices.", tags: ["writing", "communication", "drafting", "plain english"], featured: true },
  { title: "Connaught Place: A Walking History", subtitle: "Colonnades, Cafés & Bookshops of the Inner Circle", author: "Aditya Sabharwal", publisher: "Bookslab Press", category: "General", sub: "City & Heritage", mrp: 599, price: 520, edition: "1st Edition", year: 2025, pages: 240, stock: 45, rating: 4.8, reviews: 212, description: "An illustrated walk through the Georgian arcades of Connaught Place — its architecture, its booksellers and the people who made it Delhi's meeting place.", tags: ["delhi", "history", "heritage", "connaught place"] },
  { title: "The Focused Student", subtitle: "Study Habits for Professional Exams", author: "Dr. Kavita Menon", publisher: "Bookslab Academic", category: "General", sub: "Study Skills", mrp: 399, price: 340, edition: "3rd Edition", year: 2026, pages: 190, stock: 150, rating: 4.6, reviews: 640, description: "Evidence-based techniques for planning, revising and staying calm through long exam seasons — written for CA, CS, CMA, law and judiciary aspirants.", tags: ["study skills", "exams", "productivity", "revision"] },
  { title: "Money Basics for Young Professionals", subtitle: "Salary, Savings, Tax & Investing in India", author: "CA Priya Menon", publisher: "Bookslab Press", category: "General", sub: "Personal Finance", mrp: 499, price: 425, edition: "2026 Edition", year: 2026, pages: 230, stock: 95, rating: 4.5, reviews: 301, description: "A calm, jargon-free guide to your first salary slip, tax regimes, emergency funds, insurance and long-term investing — updated for the Income-tax Act, 2025.", tags: ["personal finance", "investing", "income tax", "savings"] },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

function isbn13(seed: number) {
  const body = `97893${String(81000 + seed).padStart(5, "0")}${String((seed * 37) % 100).padStart(2, "0")}`;
  const sum = body.split("").reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

function samplePages(b: Seed): string[] {
  const intro = [
    `## ${b.title}\n\n${b.edition} • ${b.year}\n${b.publisher}, New Delhi\n\nFirst published by Bookslab, Connaught Place. All rights reserved.`,
    `## How to use this book\n\n${b.description}\n\nEach chapter opens with a one-page map of the ideas you must take away. Margin marks flag exam-favourite provisions (★) and recent amendments (Δ).`,
  ];
  const body: Record<string, string[]> = {
    Law: [
      `## Chapter I — Preliminary\n\nShort title, extent and commencement. The Sanhita extends to the whole of India.\n\nΔ Commencement notified with effect from 1 July 2024. Pending matters continue under the repealed law as provided in the savings clause.`,
      `## Study note — reading a section\n\n1. Identify the act or omission.\n2. Identify the mental element: intention, knowledge, rashness or negligence.\n3. Read the explanations and illustrations — courts rely on them.\n4. Check the general exceptions before concluding.`,
      `## Concordance snapshot\n\nDefinitions → consolidated in one section\nTheft → retained, snatching added\nOrganised crime → new stand-alone provision\nSedition → replaced by acts endangering sovereignty`,
    ],
    Academic: [
      `## Illustration 1\n\nRiya Traders purchased goods worth ₹2,40,000 on credit from Gupta & Sons, Karol Bagh, with a trade discount of 10% and a cash discount of 2% if paid within 15 days. Payment was made on day 12.\n\nRequired: pass journal entries in the books of Riya Traders.`,
      `## Solution\n\nPurchases A/c Dr ₹2,16,000\n    To Gupta & Sons ₹2,16,000\n\nGupta & Sons Dr ₹2,16,000\n    To Bank A/c ₹2,11,680\n    To Discount Received ₹4,320\n\n★ Trade discount is never recorded; cash discount is.`,
      `## Past-paper weightage\n\nMay 2024 → 12 marks\nNov 2024 → 10 marks\nMay 2025 → 14 marks\nJan 2026 → 10 marks\n\nHigh weightage — practise every illustration twice.`,
    ],
    "Finance & Tax": [
      `## Return filing flow\n\n1. Reconcile the purchase register with auto-drafted statements.\n2. Finalise outward supplies and e-invoices.\n3. File the outward supply statement by the due date.\n4. Review the summary return and pay tax.`,
      `## Practitioner note — input tax credit\n\nCredit is available only when the recipient holds a valid invoice, has received the supply, the supplier has reported it and paid tax, and the return is filed.`,
      `## Worked example\n\nA Delhi-based consultant invoices ₹1,00,000 to a client in Noida (inter-state).\n\nIGST @18% = ₹18,000\nInvoice total = ₹1,18,000\n\nFor a Delhi client: CGST ₹9,000 + SGST ₹9,000.`,
    ],
    "Tech & Management": [
      `## Chapter 1 — Why this matters now\n\nIndia ships software to a billion people on patchy networks, in many languages, with payments that settle in seconds. The patterns in this book were learnt in production.`,
      `## Mental model\n\nInput → Retrieve → Reason → Act → Evaluate\n\nEvery robust system has all five. Most broken ones skip evaluation.`,
      `## Checklist before launch\n\n☐ A test set of 100 real questions\n☐ A latency budget at p95\n☐ Hindi + English evaluation\n☐ Cost per 1,000 requests tracked\n☐ A human escalation path`,
    ],
  };
  body.General = [
    `## Chapter 1\n\nGood habits are built in small, repeatable steps. This chapter sets out the three ideas the rest of the book returns to: clarity, rhythm and review.`,
    `## In practice\n\nPick one page a day. Read it twice — once for meaning, once for structure. Note one sentence you would write differently.`,
  ];
  return [...intro, ...(body[b.category] ?? body.General), `## End of preview\n\nYou've reached the end of the free preview of ${b.title}.`];
}

/** Realistic payment data for demo orders: pickup → pay at store; delivery → a mix of UPI, card and COD. */
function seedPayment(pickup: boolean, status: string, i: number, total: number, at: Date) {
  const ref = (k: string) => `BSL-${k}-${String(30000000 + i * 7919).slice(0, 8)}`;
  const cancelled = status === "Cancelled";
  if (pickup) {
    const paid = status === "Delivered";
    return { paymentMethod: "PAY_AT_STORE", paymentStatus: paid ? "Paid" : "Pending", transactionId: paid ? ref("STORE") : null, paidAt: paid ? at : null };
  }
  const method = (["UPI", "COD", "CARD", "UPI"] as const)[i % 4];
  if (method === "COD") {
    const paid = status === "Delivered";
    return { paymentMethod: "COD", paymentStatus: paid ? "Paid" : "Pending", transactionId: paid ? ref("COD") : null, paidAt: paid ? at : null, codFee: 0 };
  }
  return {
    paymentMethod: method, paymentStatus: cancelled ? "Refunded" : "Paid", transactionId: ref(method), paidAt: at,
    ...(method === "UPI" ? { upiId: i % 2 ? "reader@ybl" : null } : { cardBrand: i % 3 ? "Visa" : "RuPay", cardLast4: String(4000 + i).slice(-4) }),
    ...(cancelled ? { refundId: ref("RFND"), refundedAt: new Date(at.getTime() + 3 * 3600_000) } : {}),
  };
}

export async function seedDatabase() {
  await connectDB();
  await Promise.all([Order.deleteMany({}), Drop.deleteMany({}), SecurityLog.deleteMany({}), SearchEvent.deleteMany({}), ActivitySession.deleteMany({}), SiteContent.deleteMany({}), StoreSettings.deleteMany({}), BookRequest.deleteMany({}), ContactMessage.deleteMany({}), Book.deleteMany({}), User.deleteMany({})]); // settings fall back to defaults
  // Make sure unique / partial indexes exist before inserting (idempotent).
  await Promise.all([Book, User, Order].map((m) => m.syncIndexes()));

  const dir = path.join(process.cwd(), "public", "uploads", "books");
  await mkdir(dir, { recursive: true });
  // Orders and settings were just wiped, so their uploaded files (return proof photos, store QR) are orphans.
  for (const sub of ["returns", "settings"]) {
    const d = path.join(process.cwd(), "public", "uploads", sub);
    for (const f of await readdir(d).catch(() => [] as string[])) if (/^[\w-]+\.(jpe?g|png|webp|avif)$/i.test(f)) await unlink(path.join(d, f)).catch(() => {});
  }

  const day = 86400_000;
  const docs = await Promise.all(
    BOOKS.map(async (b, i) => {
      const slug = b.slug ?? slugify(`${b.title} ${b.year}`);
      await writeFile(path.join(dir, `seed-${slug}.svg`), coverSvg({ ...b }));
      await writeFile(path.join(dir, `seed-${slug}-back.svg`), coverSvg({ ...b, variant: "back" }));
      const format = b.format ?? "Paperback";
      return {
        title: b.title, subtitle: b.subtitle ?? "", author: b.author, publisher: b.publisher, isbn: isbn13(i + 1), category: b.category,
        subcategory: b.sub, format, mrp: b.mrp, discountedPrice: b.price, stock: b.stock, edition: b.edition, year: b.year, pages: b.pages,
        rating: b.rating, reviews: b.reviews, description: b.description, tags: b.tags, isFeatured: !!b.featured, slug,
        coverImage: `/uploads/books/seed-${slug}.svg`, galleryImages: [`/uploads/books/seed-${slug}-back.svg`],
        samplePages: samplePages(b), cpPickup: format === "Paperback" || format === "Hardcover",
        createdAt: new Date(Date.now() - (BOOKS.length - i) * day),
      };
    }),
  );
  const books = (await Book.insertMany(docs)).map((d) => d.toObject() as BookDoc);
  const by = (part: string) => books.find((b) => b.slug.includes(part))!;

  await Drop.insertMany(
    ([["applied-genai", 30, 2.4, "This week"], ["ca-final-direct-tax", 20, 4.2, "This week"], ["aibe-xx", 25, 1.3, "48-hour offer"], ["transfer-pricing", 20, 5.6, "This week"]] as const).map(
      ([s, pct, days, label]) => ({ bookId: by(s)._id, discountPct: pct, endsAt: new Date(Date.now() + days * day), label }),
    ),
  );

  await SiteContent.insertMany([
    { _id: "HERO", value: { bundleBookSlugs: [by("bharatiya-nyaya").slug, by("bharatiya-nagarik").slug, by("bharatiya-sakshya").slug] } },
    { _id: "SHOWCASE", value: { bookSlug: "ultimate-legal-tax-compendium-2026" } },
    { _id: "BANNER", value: {} },
  ]);

  const admin = await User.create({ name: "Kabir Anand", email: "admin@bookslab.in", phone: "+919810000001", passwordHash: await bcrypt.hash("Admin@2026", 10), role: "admin", isEmailVerified: true });
  const riya = await User.create({
    name: "Riya Sharma", email: "riya@student.du.ac.in", phone: "+919810000002", passwordHash: await bcrypt.hash("Student@2026", 10), isEmailVerified: true,
    addresses: [
      { label: "College", recipientName: "Riya Sharma", phone: "+919810000002", street: "Room 214, Meghdoot Hostel, North Campus, University of Delhi", city: "Delhi", state: "Delhi", pincode: "110007", isDefault: true },
      { label: "Home", recipientName: "Riya Sharma", phone: "+919810000002", street: "B-14, Hudson Lane, Kamla Nagar", city: "Delhi", state: "Delhi", pincode: "110009", isDefault: false },
    ],
  });
  const first = ["Aarav", "Ishita", "Vihaan", "Ananya", "Arjun", "Saanvi", "Kabir", "Diya", "Reyansh", "Myra", "Advait", "Kiara", "Rohan", "Tara", "Nikhil", "Zoya", "Dev", "Meher"];
  const last = ["Gupta", "Verma", "Khanna", "Malhotra", "Iyer", "Bose", "Chopra", "Kapoor", "Reddy", "Singh", "Jain", "Arora"];
  const pw = await bcrypt.hash("Customer@2026", 8);
  const others = await User.insertMany(
    first.map((f, i) => ({
      name: `${f} ${last[i % last.length]}`, email: `${f.toLowerCase()}.${last[i % last.length].toLowerCase()}${i}@example.in`, passwordHash: pw,
      isEmailVerified: true, createdAt: new Date(Date.now() - ((i * 3) % 40) * day),
    })),
  );
  const customers = [riya, ...others];

  // Orders across every status. Riya's two most recent orders are Placed / Confirmed so cancellation can be tried at once.
  const physical = books.filter((b) => b.format === "Paperback" || b.format === "Hardcover");
  const statuses = ["Delivered", "Delivered", "Delivered", "Out for Delivery", "Ready at CP Store", "Confirmed", "Placed", "Cancelled"] as const;
  const reasons = ["Ordered by mistake", "Found a newer edition", "Change in delivery plan"];
  const pins = ["110001", "110017", "110085", "201301", "122002", "110060", "110092", "121001"];
  const orders: Record<string, unknown>[] = Array.from({ length: 48 }, (_, i) => {
    const pickup = i % 3 === 0;
    const picks = [physical[(i * 7) % physical.length], physical[(i * 11 + 3) % physical.length]].slice(0, 1 + (i % 2));
    const items = picks.map((b) => ({ bookId: b._id, title: b.title, isbn: b.isbn, format: b.format, price: b.discountedPrice, quantity: i % 4 === 0 ? 2 : 1 }));
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    const deliveryFee = pickup || subtotal >= 999 ? 0 : 79;
    let status: string = statuses[i % statuses.length];
    if (pickup && status === "Out for Delivery") status = "Ready at CP Store";
    if (!pickup && status === "Ready at CP Store") status = "Out for Delivery";
    const createdAt = new Date(Date.now() - (i % 14) * day - ((i * 3600_000) % day) - 3600_000);
    const cancelled = status === "Cancelled";
    return {
      orderNumber: `BL-CP-${1001 + i}`, userId: customers[(i + 1) % customers.length]._id, items, subtotal, deliveryFee, totalAmount: subtotal + deliveryFee,
      deliveryType: pickup ? "CP Store Pickup" : "Home Delivery", status,
      shippingAddress: pickup
        ? { line: "Store pickup — Inner Circle, Connaught Place", pincode: "110001", phone: `+9198100${String(10000 + i).slice(-5)}` }
        : { line: `House ${10 + i}, Sector ${(i % 20) + 1}, New Delhi`, pincode: pins[i % pins.length], phone: `+9198100${String(10000 + i).slice(-5)}` },
      etaText: pickup ? "Ready in 2 hours" : "Next day",
      ...seedPayment(pickup, status, i, subtotal + deliveryFee, createdAt),
      cancellationReason: cancelled ? reasons[i % reasons.length] : null,
      cancelledAt: cancelled ? new Date(createdAt.getTime() + 2 * 3600_000) : null,
      cancelledBy: cancelled ? (i % 2 ? "customer" : "admin") : null,
      deliveredAt: status === "Delivered" ? new Date(createdAt.getTime() + 20 * 3600_000) : null,
      createdAt,
    };
  });
  const riyaOrder = (n: number, status: "Placed" | "Confirmed" | "Delivered", pickup: boolean, picks: BookDoc[], hoursAgo: number) => {
    const items = picks.map((b) => ({ bookId: b._id, title: b.title, isbn: b.isbn, format: b.format, price: b.discountedPrice, quantity: 1 }));
    const subtotal = items.reduce((s, it) => s + it.price, 0);
    const deliveryFee = pickup || subtotal >= 999 ? 0 : 79;
    return {
      orderNumber: `BL-CP-${n}`, userId: riya._id, items, subtotal, deliveryFee, totalAmount: subtotal + deliveryFee, status,
      deliveryType: pickup ? "CP Store Pickup" : "Home Delivery",
      shippingAddress: pickup ? { line: "Store pickup — Inner Circle, Connaught Place", pincode: "110001", phone: "+919810000002" } : { line: "B-14, Hudson Lane, Kamla Nagar, Delhi", pincode: "110009", phone: "+919810000002" },
      etaText: pickup ? "Ready in 2 hours" : "Tomorrow by 8 PM", createdAt: new Date(Date.now() - hoursAgo * 3600_000),
      ...(pickup
        ? { paymentMethod: "PAY_AT_STORE", paymentStatus: "Pending" }
        : { paymentMethod: "UPI", paymentStatus: "Paid", upiId: "riya.sharma@okicici", transactionId: `BSL-UPI-${String(48213900 + n)}`, paidAt: new Date(Date.now() - hoursAgo * 3600_000) }),
      cancellationReason: null, cancelledAt: null, cancelledBy: null,
      deliveredAt: status === "Delivered" ? new Date(Date.now() - (hoursAgo - 24) * 3600_000) : null,
    };
  };
  orders.push(
    riyaOrder(1101, "Placed", false, [by("bharatiya-nyaya"), by("bharatiya-nagarik")], 1),
    riyaOrder(1102, "Confirmed", true, [by("the-focused-student")], 20),
    riyaOrder(1103, "Delivered", false, [by("gst-ready-reckoner"), by("writing-clearly")], 72), // delivered 2 days ago → returnable
    riyaOrder(1104, "Delivered", false, [by("constitutional-law-of-india")], 13 * 24), // delivered 12 days ago → window closed
  );
  await Order.insertMany(orders);

  const cats = ["all", "law", "law", "law", "academic", "academic", "academic", "finance", "finance", "finance", "tech", "tech", "general", "pickup", "pickup"];
  const queries = ["gst", "bns", "ca final", "aibe", "constitution", "ind as", "income tax 2025", "customs", "genai", ""];
  await SearchEvent.insertMany(Array.from({ length: 240 }, (_, i) => ({ category: cats[i % cats.length], query: queries[i % queries.length], createdAt: new Date(Date.now() - (i % 14) * day) })));
  await ActivitySession.insertMany(Array.from({ length: 90 }, (_, i) => ({ _id: `seed-${i}`, userId: customers[i % customers.length]._id, seconds: 120 + ((i * 97) % 900), path: "/", createdAt: new Date(Date.now() - (i % 14) * day) })));
  await SecurityLog.insertMany(
    [admin, ...customers.slice(0, 10)].flatMap((u) => [
      { userId: u._id, identifier: u.email, event: "SIGNUP", ip: "103.21.58.10", detail: "Account created and signed in" },
      { userId: u._id, identifier: u.email, event: "LOGIN", ip: "103.21.58.10", detail: "Signed in" },
    ]),
  );

  return { books: books.length, users: customers.length + 1, orders: orders.length };
}
