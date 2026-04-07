import axios from 'axios';
import type { BulkListing } from './types';

export class DiscordWebhook {
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  /**
   * Post a single consolidated intel drop.
   * Only called when there are NEW listings to report.
   */
  async sendDrop(opts: {
    newListings: BulkListing[];
    totalThisScan: number;
    totalScanned: number;
    aiAnalysis: string;
    queriesUsed: string[];
  }) {
    if (!this.webhookUrl) return 'skipped';

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    try {
      // Build one clean embed with everything
      const lines: string[] = [];

      // Top new listings (max 8)
      const top = opts.newListings.slice(0, 8);
      for (let i = 0; i < top.length; i++) {
        const d = top[i];
        const qty = d.quantity > 1 ? ` (${d.quantity}x = **$${d.pricePerUnit}/ea**)` : '';
        const title = d.title.length > 60 ? d.title.slice(0, 57) + '...' : d.title;
        lines.push(`**$${d.price.toLocaleString()}**${qty} · \`${d.gpuModel}\` · \`${d.condition}\`\n[${title}](${d.link})`);
      }

      if (opts.newListings.length > 8) {
        lines.push(`\n*...and ${opts.newListings.length - 8} more new listings*`);
      }

      const listingsBlock = lines.join('\n\n');

      await this.post({
        embeds: [{
          title: `🖥️ GPU Intel Drop — ${dateStr}, ${timeStr}`,
          description: `**${opts.newListings.length} new listings** found (${opts.totalScanned} scanned)\n\n${listingsBlock}`,
          color: 0x8b5cf6,
          footer: { text: `OpenClaw · ${opts.queriesUsed.length} queries · Next scan in 2 min` },
          timestamp: now.toISOString(),
        }],
      });

      // If AI analysis is available, post it as a follow-up
      if (opts.aiAnalysis && opts.aiAnalysis.length > 10) {
        await this.wait();
        await this.post({
          embeds: [{
            description: opts.aiAnalysis.slice(0, 4000),
            color: 0x3b82f6,
            timestamp: now.toISOString(),
          }],
        });
      }

      return 'sent';
    } catch (err) {
      console.error('Discord drop error:', err);
      return 'error';
    }
  }

  /**
   * Post daily news digest — called once per day only.
   */
  async sendNewsDigest(newsDigest: string) {
    if (!this.webhookUrl || !newsDigest) return 'skipped';

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    try {
      await this.post({
        embeds: [{
          title: `📰 GPU Industry News — ${dateStr}`,
          description: newsDigest.slice(0, 4000),
          color: 0x5b21b6,
          footer: { text: 'OpenClaw Daily Digest' },
          timestamp: new Date().toISOString(),
        }],
      });
      return 'sent';
    } catch (err) {
      console.error('Discord news error:', err);
      return 'error';
    }
  }

  /**
   * Post a quiet "no new leads" status — so the channel shows it's still alive.
   */
  async sendHeartbeat(totalScanned: number, queriesUsed: number) {
    if (!this.webhookUrl) return 'skipped';
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    try {
      await this.post({
        content: `\`${timeStr}\` · Scanned ${totalScanned} listings across ${queriesUsed} queries · No new leads this cycle`,
      });
      return 'sent';
    } catch (err) {
      return 'error';
    }
  }

  private async post(payload: Record<string, unknown>) {
    await axios.post(this.webhookUrl!, payload);
  }

  private wait(ms = 1200) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
