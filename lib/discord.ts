import axios from 'axios';
import type { NewsItem } from './news-scraper';
import type { GpuListing, CompanyLead, MarketIntel } from './types';

export class DiscordWebhook {
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  /**
   * Post the full GPU Intel Drop — DJ Command Center format.
   */
  async sendIntelDrop(opts: {
    listings: GpuListing[];
    leads: CompanyLead[];
    intel: MarketIntel[];
    news: NewsItem[];
    actionItem: string;
    totalScanned: number;
  }) {
    if (!this.webhookUrl) return 'skipped';

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    try {
      // ── MESSAGE 1: GPU INTEL DROP ──────────────────────
      let msg1 = `🖥️ **GPU Intel Drop — ${dateStr}**\n`;
      msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Market Pulse
      msg1 += `**📊 Market Pulse**\n`;
      const modelCounts: Record<string, { count: number; min: number; max: number }> = {};
      for (const l of opts.listings) {
        if (!modelCounts[l.gpuModel]) modelCounts[l.gpuModel] = { count: 0, min: Infinity, max: 0 };
        modelCounts[l.gpuModel].count++;
        modelCounts[l.gpuModel].min = Math.min(modelCounts[l.gpuModel].min, l.pricePerUnit);
        modelCounts[l.gpuModel].max = Math.max(modelCounts[l.gpuModel].max, l.pricePerUnit);
      }
      const sortedModels = Object.entries(modelCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
      for (const [model, data] of sortedModels) {
        const range = data.min === data.max
          ? `$${data.min.toLocaleString()}`
          : `$${data.min.toLocaleString()}–$${data.max.toLocaleString()}`;
        msg1 += `• ${model}: ${range}/unit (${data.count} listings)\n`;
      }

      const bulkCount = opts.listings.filter(l => l.quantity > 1).length;
      msg1 += `• ${opts.listings.length} total listings from ${opts.totalScanned} scanned\n`;
      if (bulkCount > 0) msg1 += `• ${bulkCount} bulk lot${bulkCount > 1 ? 's' : ''} detected\n`;
      msg1 += '\n';

      // Notable Bulk GPU Lots
      const highlights = opts.listings
        .filter(l => l.quantity > 1 || l.score >= 50)
        .slice(0, 5);
      if (highlights.length > 0) {
        msg1 += `**🔍 Notable Bulk GPU Lots**\n`;
        for (const d of highlights) {
          const qty = d.quantity > 1 ? `${d.quantity}x @ $${d.pricePerUnit.toLocaleString()}/ea` : `$${d.price.toLocaleString()}`;
          msg1 += `• **${d.gpuModel}** — ${qty} | ${d.condition}\n`;
          msg1 += `  ${d.title.slice(0, 65)}\n`;
          msg1 += `  ${d.link}\n`;
        }
        msg1 += '\n';
      }

      // Action Item
      msg1 += `**⚡ Action Item**\n`;
      msg1 += opts.actionItem + '\n\n';
      msg1 += `🕐 ${timeStr} · Next scan: tomorrow at noon`;

      await this.postSafe(msg1);
      await this.wait();

      // ── MESSAGE 2: COMPANY LEADS ──────────────────────
      if (opts.leads.length > 0) {
        let msg2 = `**🏢 GPU Supplier Leads Found**\n\n`;
        for (const lead of opts.leads.slice(0, 5)) {
          const priority = lead.priority === 'High' ? '🔴' : lead.priority === 'Medium' ? '🟡' : '🟢';
          msg2 += `${priority} **${lead.company}** (${lead.type})\n`;
          msg2 += `• ${lead.description.slice(0, 100)}\n`;
          msg2 += `• GPUs: ${lead.gpuModels} · ${lead.location}\n`;
          msg2 += `• https://${lead.website}\n\n`;
        }
        msg2 += `_${opts.leads.length} total leads tracked. Prioritize ITAD/Liquidator contacts._`;

        await this.postSafe(msg2);
        await this.wait();
      }

      // ── MESSAGE 3: GPU NEWS ───────────────────────────
      if (opts.news.length > 0) {
        let msg3 = `**📰 Top GPU News Today**\n\n`;
        for (const n of opts.news.slice(0, 6)) {
          const time = n.time ? ` · _${n.time}_` : '';
          msg3 += `▸ [**${n.headline}**](${n.link})\n`;
          msg3 += `  ${n.source}${time}\n\n`;
        }
        msg3 += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg3 += `_${opts.news.length} headlines · Synced to Google Sheet_`;

        await this.postSafe(msg3);
      }

      return 'sent';
    } catch (err) {
      console.error('Discord intel drop error:', err);
      return 'error';
    }
  }

  /**
   * Heartbeat — when nothing notable found.
   */
  async sendHeartbeat() {
    if (!this.webhookUrl) return 'skipped';
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    try {
      await this.post({
        content: `\`${timeStr}\` · Scan complete. No notable GPU deals or news this cycle.`,
      });
      return 'sent';
    } catch { return 'error'; }
  }

  /**
   * Post message, splitting if over 2000 chars.
   */
  private async postSafe(content: string) {
    if (content.length <= 2000) {
      await this.post({ content });
    } else {
      const midpoint = content.lastIndexOf('\n\n', 1800);
      const part1 = content.slice(0, midpoint > 0 ? midpoint : 1800);
      const part2 = content.slice(midpoint > 0 ? midpoint + 2 : 1800);
      await this.post({ content: part1 });
      await this.wait();
      if (part2.trim()) await this.post({ content: part2 });
    }
  }

  private async post(payload: Record<string, unknown>) {
    await axios.post(this.webhookUrl!, payload);
  }

  private wait(ms = 1500) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
