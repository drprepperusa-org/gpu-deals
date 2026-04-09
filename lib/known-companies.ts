/**
 * Known GPU procurement companies — DJ's curated database.
 * These are companies that sell, liquidate, or decommission bulk GPUs.
 * The scanner uses this list to identify and enrich leads.
 */

export interface KnownCompany {
  company: string;
  category: string;
  location: string;
  whyTheyHaveGpus: string;
  scale: string;
  gpuModels: string;
  contactApproach: string;
  website: string;
  phone: string;
  email: string;
  keyPerson: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  notes: string;
}

export const KNOWN_COMPANIES: KnownCompany[] = [
  // ─── DC Operators (Colo) ───────────────────────────────
  {
    company: 'Equinix', category: 'DC Operator (Colo)', location: 'Redwood City, CA',
    whyTheyHaveGpus: '260+ DCs globally; 3-5yr hardware refresh cycles; customers decommission GPU servers; Equinix partners with NVIDIA on AI DCs',
    scale: '260 DCs, 70 metros, 32 countries; $8B+ revenue',
    gpuModels: 'A100, H100 (customer surplus)',
    contactApproach: 'Contact Global Solutions team; ask about customer hardware remarketing programs',
    website: 'equinix.com', phone: '+1 (866) 378-4649', email: 'info@equinix.com',
    keyPerson: 'VP of Global Sales / Account Exec', priority: 'HIGH',
    notes: 'Largest colo operator; huge customer base cycling through GPU hardware',
  },
  {
    company: 'Digital Realty', category: 'DC Operator (Colo)', location: 'Austin, TX',
    whyTheyHaveGpus: '300+ facilities; hosts CoreWeave, hyperscalers; customers refresh GPU clusters',
    scale: '300+ DCs, 50+ metros, 25+ countries',
    gpuModels: 'H100, A100 (tenant surplus)',
    contactApproach: 'Contact Enterprise Solutions; inquire about tenant hardware disposition programs',
    website: 'digitalrealty.com', phone: '+1 (737) 281-0101', email: 'info@digitalrealty.com',
    keyPerson: 'SVP Sales / Enterprise Account Manager', priority: 'HIGH',
    notes: 'Hosts CoreWeave GPUs; customers cycling through A100→H100→B200',
  },
  {
    company: 'CoreWeave', category: 'Neocloud GPU Provider', location: 'Roseland, NJ',
    whyTheyHaveGpus: '100K+ GPUs; 3-yr depreciation cycles; H100s from 2022 contracts starting to cycle; B200 upgrades will push H100s to secondary market',
    scale: '28+ facilities, $12B+ funding, 100K+ NVIDIA GPUs',
    gpuModels: 'H100 80GB SXM, A100 80GB, InfiniBand',
    contactApproach: 'Contact hardware disposition team; build relationship for when they sell surplus',
    website: 'coreweave.com', phone: '', email: 'sales@coreweave.com',
    keyPerson: 'Head of Hardware / VP Infrastructure', priority: 'HIGH',
    notes: 'PRIME TARGET: Largest GPU-focused cloud; B200 transition will create surplus',
  },
  {
    company: 'CyrusOne', category: 'DC Operator (Colo)', location: 'Dallas, TX',
    whyTheyHaveGpus: '55+ DCs; enterprise customers upgrading AI infrastructure',
    scale: '55+ DCs, ~1,000 MW capacity, 5M+ SF',
    gpuModels: 'A100, V100, T4 (enterprise customers)',
    contactApproach: 'Contact Enterprise Solutions about customer surplus programs',
    website: 'cyrusone.com', phone: '+1 (855) 564-4200', email: 'sales@cyrusone.com',
    keyPerson: 'VP Enterprise Solutions', priority: 'MEDIUM',
    notes: 'Owned by KKR/GIP; expanding GPU-ready facilities',
  },
  {
    company: 'QTS Realty Trust', category: 'DC Operator (Colo)', location: 'Ashburn, VA',
    whyTheyHaveGpus: 'Hyperscale & enterprise colo; customers include cloud providers deploying and retiring GPU clusters',
    scale: '3,000+ acres, hyperscale campuses',
    gpuModels: 'A100, H100 (hyperscale tenant surplus)',
    contactApproach: 'Contact Enterprise team about IT asset lifecycle programs for tenants',
    website: 'qtsdatacenters.com', phone: '+1 (877) 787-3282', email: 'sales@qtsdatacenters.com',
    keyPerson: 'VP Sales / Account Manager', priority: 'MEDIUM',
    notes: 'Hyperscale focus means large-batch GPU decommissions',
  },
  {
    company: 'CoreSite', category: 'DC Operator (Colo)', location: 'Denver, CO',
    whyTheyHaveGpus: '25+ DCs; strong Silicon Valley & LA presence; AI/ML customers cycling GPUs',
    scale: '25+ DCs, SV/LA/NY/DC/Chicago',
    gpuModels: 'A100, T4, V100 (enterprise customer surplus)',
    contactApproach: 'Contact Sales; focus on SV and LA campus locations',
    website: 'coresite.com', phone: '+1 (866) 777-2673', email: 'sales@coresite.com',
    keyPerson: 'Director of Sales', priority: 'MEDIUM',
    notes: 'Strong Silicon Valley presence = AI/ML startup customers upgrading frequently',
  },
  {
    company: 'Flexential', category: 'DC Operator (Colo)', location: 'Charlotte, NC',
    whyTheyHaveGpus: 'Hosts CoreWeave GPUs; enterprise HPC customers',
    scale: '40+ DCs, 19 markets',
    gpuModels: 'H100, A100 (CoreWeave & enterprise)',
    contactApproach: 'Contact Sales about hardware remarketing for hosted customers',
    website: 'flexential.com', phone: '+1 (877) 448-6539', email: 'info@flexential.com',
    keyPerson: 'VP Sales / HPC Account Manager', priority: 'MEDIUM',
    notes: 'Direct CoreWeave GPU hosting relationship',
  },
  {
    company: 'Switch', category: 'DC Operator (Colo)', location: 'Las Vegas, NV',
    whyTheyHaveGpus: 'Massive exascale DCs; hosts AI/ML workloads; 100% renewable',
    scale: 'Multiple exascale campuses (LAS, ATL, GR)',
    gpuModels: 'A100, H100 (hyperscale customers)',
    contactApproach: 'Contact Enterprise Solutions; Switch campuses are among the most GPU-dense in US',
    website: 'switch.com', phone: '+1 (702) 444-4111', email: 'info@switch.com',
    keyPerson: 'VP Enterprise Sales', priority: 'MEDIUM',
    notes: 'CoreWeave has Las Vegas presence at Switch facilities',
  },
  {
    company: 'Iron Mountain Data Centers', category: 'DC Operator (Colo)', location: 'Boston, MA',
    whyTheyHaveGpus: 'Underground DCs; ITAD heritage; already has asset disposition DNA',
    scale: '5M+ SF, 415+ MW, 1.3 GW pipeline',
    gpuModels: 'A100, T4, V100 (enterprise customers)',
    contactApproach: 'Contact their ITAD/Asset Lifecycle team directly',
    website: 'ironmountain.com/data-centers', phone: '+1 (800) 899-4766', email: 'datacenters@ironmountain.com',
    keyPerson: 'Director of ITAD / Asset Lifecycle', priority: 'HIGH',
    notes: 'UNIQUE: Iron Mountain already has ITAD DNA from records/storage business',
  },
  // ─── ITAD / GPU Specialists ────────────────────────────
  {
    company: 'exIT Technologies', category: 'ITAD / GPU Specialist', location: 'USA (National)',
    whyTheyHaveGpus: 'CERTIFIED ITAD specializing in GPU buyback; buys from data centers, cloud providers, enterprises',
    scale: 'R2v3, HIPAA, ISO 14001, NIST certified; 30+ yr track record',
    gpuModels: 'H100, A100, A40, T4, V100 + consumer GPUs',
    contactApproach: 'DIRECT GPU BUYING CHANNEL: Submit inventory list for quote',
    website: 'exittechnologies.com', phone: '', email: 'Via website contact form',
    keyPerson: 'Kyle Bittner & Nick Villegas', priority: 'HIGH',
    notes: 'TOP ITAD GPU BUYER: Explicitly buys datacenter GPUs; handles international logistics',
  },
  {
    company: 'Net Equity', category: 'ITAD / GPU Specialist', location: 'USA (National)',
    whyTheyHaveGpus: 'Specialized in NVIDIA GPU buyback, trade-in, consignment',
    scale: 'Competitive buyback + consignment remarketing',
    gpuModels: 'H100, A100, InfiniBand, GPU servers',
    contactApproach: 'Submit contact form for GPU buyback quote',
    website: 'netequity.com', phone: '', email: 'Via netequity.com/products/nvidia-gpu-products/',
    keyPerson: 'Buyer Agent (via contact form)', priority: 'HIGH',
    notes: 'GPU-FOCUSED remarketing; good source to BUY from as well',
  },
  {
    company: 'BuySellRam.com', category: 'ITAD / GPU Specialist', location: 'USA (National)',
    whyTheyHaveGpus: 'Buys bulk GPUs: Tesla H100, A100, Quadro, GeForce, AMD Instinct',
    scale: 'Bulk GPU purchasing across all NVIDIA/AMD product lines',
    gpuModels: 'H100, A100, A40, T4, V100, Quadro RTX, AMD MI-series',
    contactApproach: 'Submit GPU inventory list for bulk quote',
    website: 'buysellram.com', phone: '', email: 'Via buysellram.com/sell-graphics-card-gpu/',
    keyPerson: 'Purchasing Team', priority: 'MEDIUM',
    notes: 'Wide GPU coverage; good for commodity-grade GPUs as well as datacenter cards',
  },
  {
    company: 'SK tes', category: 'ITAD / Global DC Decom', location: 'Global',
    whyTheyHaveGpus: 'Major global ITAD; recovers value from servers, GPUs; ties to hyperscale data centers',
    scale: 'Global scale; hyperscale DC relationships',
    gpuModels: 'H100, A100, T4, all datacenter GPUs',
    contactApproach: 'Request their Market Insights Report for enterprise GPU equipment',
    website: 'sktes.com', phone: '', email: 'Via sktes.com contact',
    keyPerson: 'DC Decommissioning Team', priority: 'HIGH',
    notes: 'KEY: Strong ties to hyperscale data centers; tracks GPU pricing globally',
  },
  // ─── Refurbished GPU Dealers ───────────────────────────
  {
    company: 'Jeskell Systems', category: 'Refurbished GPU Dealer', location: 'USA',
    whyTheyHaveGpus: 'Sells preowned GPU servers (H100, A100) with warranty; sourced from decommissioned data centers',
    scale: 'Limited but active inventory of 8x H100/A100 servers',
    gpuModels: 'H100 80GB ($218K for 8x), A100 80GB',
    contactApproach: 'BUY preowned GPU servers at 33% discount vs new; 3-year warranty',
    website: 'jeskell.com', phone: '', email: 'Via jeskell.com contact',
    keyPerson: 'Sales Team', priority: 'HIGH',
    notes: 'BUYING OPP: 8x H100 servers at $218K vs $325K list',
  },
  {
    company: 'Alta Technologies', category: 'ITAD / Refurbished', location: 'USA (National)',
    whyTheyHaveGpus: 'Since 1995; R2v3 certified ITAD; buys and sells refurbished enterprise servers including GPU configs',
    scale: 'R2v3, ASCDI ITAD certified, ISO 9001/14001',
    gpuModels: 'GPU servers, A100 configs, enterprise GPU',
    contactApproach: 'Contact for same-day quote on surplus hardware',
    website: 'altatechnologies.com', phone: '', email: 'Via website; same-day quotes',
    keyPerson: 'Sales / ITAD Team', priority: 'MEDIUM',
    notes: 'Strong ITAD credentials; 30+ year track record; bidirectional',
  },
  {
    company: 'UNIXSurplus', category: 'Refurbished Dealer', location: 'USA',
    whyTheyHaveGpus: 'B2B refurbished servers & storage; white glove service for DCs, startups',
    scale: 'B2B enterprise hardware solutions',
    gpuModels: 'GPU servers, enterprise configurations',
    contactApproach: 'They offer proof-of-concept testing; try GPU servers before buying',
    website: 'unixsurplus.com', phone: '+1 (877) 864-9123', email: 'Via website',
    keyPerson: 'Sales Team', priority: 'MEDIUM',
    notes: 'UNIQUE: Offers proof-of-concept testing; try before you buy',
  },
  // ─── DC Equipment Brokers ──────────────────────────────
  {
    company: 'Dataknox Solutions', category: 'ITAD / DC Services', location: 'USA',
    whyTheyHaveGpus: 'DC decommissioning + IT asset repurchase; buys retired servers, GPUs from data centers',
    scale: 'Global multi-site decommissioning capability',
    gpuModels: 'Server GPUs, A100, networking gear',
    contactApproach: 'Contact about IT asset repurchase program for GPU hardware',
    website: 'dataknox.io', phone: '', email: 'Via dataknox.io contact',
    keyPerson: 'Decommissioning Team', priority: 'MEDIUM',
    notes: 'Handles complex multi-site decomms where GPU surplus emerges',
  },
  {
    company: 'ReluTech', category: 'ITAD / DC Equipment', location: 'USA',
    whyTheyHaveGpus: 'Buys from DC decommissions; sells refurbished DC equipment; rental program',
    scale: 'Growing inventory from DC decommissions',
    gpuModels: 'GPU servers, A100, networking, storage',
    contactApproach: 'Contact about GPU server inventory from recent decommissions; also offer rental',
    website: 'relutech.com', phone: '', email: 'Via relutech.com contact',
    keyPerson: 'Sales Team', priority: 'MEDIUM',
    notes: 'Interesting RENTAL option for GPUs during cloud migrations',
  },
  {
    company: 'BrightStar Systems', category: 'DC Equipment Broker', location: 'USA',
    whyTheyHaveGpus: '45 years combined experience; wholesale and liquidation; buys/sells datacenter equipment',
    scale: 'Wholesale & liquidation reseller',
    gpuModels: 'GPU servers, Juniper, Arista, Cisco',
    contactApproach: 'Reach out with list; they cover shipping and provide quick payment',
    website: 'brightstarsystems.com', phone: '', email: 'Via website contact',
    keyPerson: 'Sales Team', priority: 'LOW',
    notes: 'Wholesale liquidation; 45yr combined experience',
  },
  {
    company: 'eNetwork Supply', category: 'DC Equipment Broker', location: 'Chicago, IL',
    whyTheyHaveGpus: 'Buys & sells DC equipment; buyback program + consignment',
    scale: 'Active DC equipment procurement',
    gpuModels: 'Server GPUs, networking, switches',
    contactApproach: 'Submit equipment list for competitive offer',
    website: 'enetworksupply.com', phone: '+1 (312) 283-5983', email: 'Via website contact',
    keyPerson: 'Procurement Team', priority: 'LOW',
    notes: 'Chicago-based; active in DC equipment buyback',
  },
  {
    company: 'SourceTech', category: 'DC Equipment Broker', location: 'USA (National)',
    whyTheyHaveGpus: 'Buys surplus IT nationwide; from single units to entire DC liquidations',
    scale: 'Nationwide; handles single units to full DCs',
    gpuModels: 'GPU servers, Dell, HPE, networking',
    contactApproach: 'Email inventory list for quote; handles full warehouse liquidations',
    website: 'source-tech.net', phone: '', email: 'Via source-tech.net contact',
    keyPerson: 'Purchasing Team', priority: 'LOW',
    notes: 'Good for bulk purchases of mixed hardware lots',
  },
  {
    company: 'ITAD ECO Plus', category: 'ITAD / National', location: 'CA, CO, AZ, FL, TX',
    whyTheyHaveGpus: 'National DC decommissioning; harvests and resells high-value components including GPUs',
    scale: 'Nationwide: CA, CO, AZ, FL, TX offices; 30+ years',
    gpuModels: 'GPU harvest from servers; all enterprise brands',
    contactApproach: 'Call or email for decommissioned GPU server inventory',
    website: 'itad-company.com', phone: '+1 (877) 592-6009', email: 'Support@ITAD-Company.com',
    keyPerson: 'ITAD Support Team', priority: 'MEDIUM',
    notes: 'Explicitly categorize hardware as "Harvestable" including GPUs',
  },
];

/**
 * Check if a scraped company matches a known company.
 */
export function matchKnownCompany(name: string): KnownCompany | null {
  const lower = name.toLowerCase();
  return KNOWN_COMPANIES.find(c => lower.includes(c.company.toLowerCase())) || null;
}

/**
 * Get all known companies as leads for seeding the database.
 */
export function getAllKnownCompanies() {
  return KNOWN_COMPANIES;
}
