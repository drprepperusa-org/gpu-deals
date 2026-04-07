import type { DatacenterLead } from './types';

/**
 * Known ITAD / Liquidation contacts for datacenter GPU sourcing.
 * These are curated leads — the dashboard displays them for outreach tracking.
 */
const KNOWN_LEADS: DatacenterLead[] = [
  {
    id: 'lead-001',
    company: 'TechWaste Recycling Inc.',
    website: 'techwasterecycling.com',
    type: 'ITAD',
    description: 'NIST 800-88 & R2v3 certified data center decommissioning. Partners with enterprise clients doing full DC teardowns.',
    location: 'USA (National)',
    outreachAngle: 'Bulk purchase agreements for liquidated enterprise GPU inventory',
    status: 'new',
    addedAt: new Date().toISOString(),
    notes: 'High potential — handles enterprise DC teardowns regularly',
  },
  {
    id: 'lead-002',
    company: 'Excess IT Hardware',
    website: 'excessithardware.com',
    type: 'Liquidator',
    description: 'Full-spectrum data center liquidation. Specialize in value recovery from DC shutdowns.',
    location: 'Boynton Beach, FL',
    outreachAngle: 'Direct purchase from their liquidation pipeline',
    status: 'new',
    addedAt: new Date().toISOString(),
    notes: 'Track assets by serial for compliance; good for audited purchases',
  },
  {
    id: 'lead-003',
    company: 'Compute Exchange',
    website: 'computeexchange.com',
    type: 'Reseller',
    description: 'GPU brokerage and resale marketplace for enterprise hardware. Strong resale velocity reported.',
    location: 'USA',
    outreachAngle: 'Partnership for early access to incoming GPU inventory before public listing',
    status: 'new',
    addedAt: new Date().toISOString(),
    notes: 'Seeing strong resale velocity per recent reports',
  },
  {
    id: 'lead-004',
    company: 'Iron Mountain ITAD',
    website: 'ironmountain.com',
    type: 'ITAD',
    description: 'Enterprise ITAD services with certified data destruction. Handles Fortune 500 decommissions.',
    location: 'USA (National)',
    outreachAngle: 'GPU-specific bulk purchase from their ITAD pipeline',
    status: 'new',
    addedAt: new Date().toISOString(),
    notes: 'Massive scale — handles F500 clients',
  },
  {
    id: 'lead-005',
    company: 'Accio.com',
    website: 'accio.com',
    type: 'Reseller',
    description: 'B2B marketplace with 13,000+ suppliers. Active bulk RTX 4090 listings from Chinese wholesalers.',
    location: 'Global',
    outreachAngle: 'Volume pricing negotiation for 10+ unit GPU lots',
    status: 'new',
    addedAt: new Date().toISOString(),
    notes: 'Current pricing $2,239-$3,125/unit (5+ min order). 50,000+ suppliers.',
  },
  {
    id: 'lead-006',
    company: 'Curvature (Park Place Technologies)',
    website: 'curvature.com',
    type: 'ITAD',
    description: 'Major ITAD player — buys, refurbs, and resells datacenter hardware at scale.',
    location: 'USA / Global',
    outreachAngle: 'Bulk GPU buy from their refurb pipeline; ask about upcoming DC teardowns',
    status: 'new',
    addedAt: new Date().toISOString(),
    notes: 'One of the largest ITAD operations globally',
  },
  {
    id: 'lead-007',
    company: 'MarkITx (Arrow Electronics)',
    website: 'markitx.com',
    type: 'ITAD',
    description: 'Arrow Electronics ITAD arm. Processes massive volumes of enterprise hardware.',
    location: 'USA / Global',
    outreachAngle: 'GPU-specific buyback from enterprise refresh cycles',
    status: 'new',
    addedAt: new Date().toISOString(),
    notes: 'Arrow is a Fortune 500; their ITAD sees huge volumes',
  },
];

export function getKnownLeads(): DatacenterLead[] {
  return KNOWN_LEADS;
}
