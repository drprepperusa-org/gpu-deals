import axios from 'axios';
import type { BulkListing } from './types';

interface DatacenterLead {
  company: string;
  website: string;
  type: string;
  description: string;
  location: string;
  outreachAngle: string;
}

export class DiscordWebhook {
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  /**
   * Post the GPU Intel Drop — main daily report.
   */
  async sendIntelDrop(opts: {
    listings: BulkListing[];
    totalScanned: number;
    leads: DatacenterLead[];
    queriesUsed: string[];
  }) {
    if (!this.webhookUrl) return 'skipped';

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });

    const bulkListings = opts.listings.filter(l => l.quantity > 1);
    const dcListings = opts.listings.filter(l => {
      const t = l.title.toLowerCase();
      return t.includes('datacenter') || t.includes('data center') || t.includes('server pull') || t.includes('enterprise') || t.includes('liquidation') || t.includes('decommission');
    });

    // Price ranges
    const prices = opts.listings.map(l => l.pricePerUnit).sort((a, b) => a - b);
    const cheapest = prices[0] || 0;

    // Model breakdown
    const modelCounts: Record<string, { count: number; minPrice: number; maxPrice: number }> = {};
    for (const l of opts.listings) {
      if (!modelCounts[l.gpuModel]) modelCounts[l.gpuModel] = { count: 0, minPrice: Infinity, maxPrice: 0 };
      modelCounts[l.gpuModel].count++;
      modelCounts[l.gpuModel].minPrice = Math.min(modelCounts[l.gpuModel].minPrice, l.pricePerUnit);
      modelCounts[l.gpuModel].maxPrice = Math.max(modelCounts[l.gpuModel].maxPrice, l.pricePerUnit);
    }

    try {
      // ── 1. INTEL DROP ──────────────────────────────────
      let intelDrop = `🖥️ **GPU Intel Drop — ${dateStr}**\n\n`;

      // Market Pulse
      intelDrop += `**📊 Market Pulse**\n`;
      const modelLines = Object.entries(modelCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 6)
        .map(([model, data]) => {
          if (data.minPrice === data.maxPrice) return `• ${model}: $${data.minPrice.toLocaleString()}/unit (${data.count} listings)`;
          return `• ${model}: $${data.minPrice.toLocaleString()}–$${data.maxPrice.toLocaleString()}/unit (${data.count} listings)`;
        });
      intelDrop += modelLines.join('\n') + '\n';
      intelDrop += `• ${opts.listings.length} total listings found across ${opts.totalScanned} scanned\n`;
      if (bulkListings.length > 0) intelDrop += `• ${bulkListings.length} bulk lot${bulkListings.length > 1 ? 's' : ''} detected\n`;
      if (dcListings.length > 0) intelDrop += `• ${dcListings.length} datacenter/enterprise listing${dcListings.length > 1 ? 's' : ''} spotted\n`;
      intelDrop += '\n';

      // Bulk Lots Spotted
      if (bulkListings.length > 0 || dcListings.length > 0) {
        const highlights = [...dcListings, ...bulkListings]
          .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)
          .slice(0, 5);

        intelDrop += `**🔍 Bulk Lots & DC Listings Spotted:**\n`;
        for (const d of highlights) {
          const qty = d.quantity > 1 ? `${d.quantity} units available @ $${d.pricePerUnit.toLocaleString()}/ea` : `$${d.price.toLocaleString()}`;
          intelDrop += `• **${d.gpuModel}** — ${d.title.slice(0, 70)}${d.title.length > 70 ? '...' : ''}\n`;
          intelDrop += `  ${qty} | ${d.condition} | ${d.seller}\n`;
          intelDrop += `  ${d.link}\n`;
        }
        intelDrop += '\n';
      }

      // Top Deals
      const topDeals = opts.listings.slice(0, 5);
      if (topDeals.length > 0 && (bulkListings.length === 0 && dcListings.length === 0)) {
        intelDrop += `**🔍 Top Listings Found:**\n`;
        for (const d of topDeals) {
          const qty = d.quantity > 1 ? ` (${d.quantity}x = $${d.pricePerUnit.toLocaleString()}/ea)` : '';
          intelDrop += `• **${d.gpuModel}** — $${d.price.toLocaleString()}${qty} | ${d.condition}\n`;
          intelDrop += `  ${d.title.slice(0, 65)}${d.title.length > 65 ? '...' : ''}\n`;
          intelDrop += `  ${d.link}\n`;
        }
        intelDrop += '\n';
      }

      // Action Item
      intelDrop += `**⚡ Action Item**\n`;
      if (dcListings.length > 0) {
        intelDrop += `${dcListings.length} datacenter listings found this cycle. Review the links above — bulk lots from DC decommissions are the highest-value targets. Contact sellers directly for volume pricing.\n\n`;
      } else if (bulkListings.length > 0) {
        intelDrop += `${bulkListings.length} bulk lots spotted. Monitor these sellers for restocks. Set alerts for quantity listings from high-feedback sellers.\n\n`;
      } else {
        intelDrop += `No bulk or datacenter lots this cycle. Continue monitoring — decommission waves are cyclical. Focus outreach on ITAD contacts below.\n\n`;
      }

      // Flags
      if (cheapest > 700) {
        intelDrop += `⚠️ No sub-$700/unit bulk listings found this cycle.\n`;
      }
      intelDrop += `🕐 Checked: ${timeStr} | Next scan: scheduled\n`;

      await this.post({ content: intelDrop.slice(0, 2000) });
      await this.wait();

      // ── 2. LEADS (if available) ────────────────────────
      if (opts.leads.length > 0) {
        let leadsMsg = `**🏢 Datacenter Decommissioning Contacts**\n\n`;
        for (const lead of opts.leads.slice(0, 4)) {
          leadsMsg += `**${lead.company}** (${lead.website})\n`;
          leadsMsg += `• What: ${lead.description.slice(0, 100)}\n`;
          leadsMsg += `• Outreach: "${lead.outreachAngle}"\n`;
          leadsMsg += `• Location: ${lead.location}\n\n`;
        }
        leadsMsg += `---\n*${opts.leads.length} total leads tracked. Expand outreach to 3-5 contacts/week for best results.*`;

        await this.post({ content: leadsMsg.slice(0, 2000) });
        await this.wait();
      }

      return 'sent';
    } catch (err) {
      console.error('Discord intel drop error:', err);
      return 'error';
    }
  }

  /**
   * Post GPU Industry News — real scraped headlines.
   */
  async sendNews(newsText: string) {
    if (!this.webhookUrl || !newsText) return 'skipped';

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    try {
      let msg = `**GPU Industry News — ${dateStr}**\n\n`;
      msg += newsText;
      msg += `\n\n📌 *Market Signal: Monitor datacenter decommission cycles. Bulk acquisition from DC teardowns remains the highest-margin opportunity.*`;

      await this.post({ content: msg.slice(0, 2000) });
      return 'sent';
    } catch (err) {
      console.error('Discord news error:', err);
      return 'error';
    }
  }

  /**
   * Heartbeat — quiet status when no new listings.
   */
  async sendHeartbeat(totalScanned: number, queriesUsed: number) {
    if (!this.webhookUrl) return 'skipped';
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    try {
      await this.post({
        content: `\`${timeStr}\` · Scanned ${totalScanned} listings across ${queriesUsed} queries · No new leads this cycle`,
      });
      return 'sent';
    } catch { return 'error'; }
  }

  private async post(payload: Record<string, unknown>) {
    await axios.post(this.webhookUrl!, payload);
  }

  private wait(ms = 1500) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
