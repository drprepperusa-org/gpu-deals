// ─── Core Types ─────────────────────────────────────────

export interface GPUPriceIndex {
  model: string;
  currentPrice: number;
  previousPrice: number;
  change: number;       // percentage
  trend: 'up' | 'down' | 'flat';
  source: string;
  updatedAt: string;
}

export interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  tags: string[];        // e.g. ['pricing', 'supply', 'datacenter']
}

export interface MarketSignal {
  signal: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
  reasoning: string;
  keyMetrics: string[];
  generatedAt: string;
}

export interface BulkListing {
  id: string;
  title: string;
  price: number;
  pricePerUnit: number;
  quantity: number;
  gpuModel: string;
  source: string;        // 'ebay' | 'wholesale' | 'liquidation' | 'auction'
  seller: string;
  condition: string;
  link: string;
  foundAt: string;
}

export interface DatacenterLead {
  id: string;
  company: string;
  website: string;
  type: string;          // 'ITAD' | 'Liquidator' | 'Decommission' | 'Reseller'
  description: string;
  location: string;
  outreachAngle: string;
  status: 'new' | 'contacted' | 'responded' | 'deal' | 'dead';
  addedAt: string;
  notes: string;
}

export interface IntelDrop {
  id: string;
  date: string;
  marketPulse: string;
  bestFind: string;
  pricingSnapshot: GPUPriceIndex[];
  listings: BulkListing[];
  leads: DatacenterLead[];
  news: NewsItem[];
  signal: MarketSignal;
  actionItems: string[];
  generatedAt: string;
}

export interface DealScanConfig {
  queries: string[];
  maxPrice: number;
  minQuantity: number;
  sources: string[];
  excludeKeywords: string[];
  maxPages: number;
}
