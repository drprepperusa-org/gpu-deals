export interface GpuListing {
  title: string;
  price: number;
  pricePerUnit: number;
  quantity: number;
  gpuModel: string;
  condition: string;
  seller: string;
  link: string;
  source: string; // 'ebay' | 'bidspotter' | 'hibid' | 'liquidation'
  foundAt: string;
  score: number;
}

export interface CompanyLead {
  company: string;
  website: string;
  type: string; // 'ITAD' | 'Liquidator' | 'Auction' | 'Reseller'
  description: string;
  location: string;
  gpuModels: string;
  priority: 'High' | 'Medium' | 'Low';
  notes: string;
  foundAt: string;
}

export interface MarketIntel {
  timestamp: string;
  finding: string;
  sourceLink: string;
}

export interface DailyFindings {
  date: string;
  listings: GpuListing[];
  leads: CompanyLead[];
  marketIntel: MarketIntel[];
  news: { headline: string; source: string; link: string; time: string }[];
}
