import axios from 'axios';
import type { GpuListing, CompanyLead } from './types';
import { generateFullReport } from './intel';

export class DiscordWebhook {
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  /**
   * Post the full GPU Intel Drop — DJ Command Center style.
   */
  async sendIntelDrop(opts: {
    listings: GpuListing[];
    leads: CompanyLead[];
    totalScanned: number;
    sources: Record<string, number>;
  }) {
    if (!this.webhookUrl) return 'skipped';

    try {
      const report = generateFullReport(opts);

      // Split into chunks of 2000 chars (Discord limit)
      const chunks: string[] = [];
      let current = '';

      for (const line of report.split('\n')) {
        if (current.length + line.length + 1 > 1950) {
          chunks.push(current);
          current = line;
        } else {
          current += (current ? '\n' : '') + line;
        }
      }
      if (current) chunks.push(current);

      for (let i = 0; i < chunks.length; i++) {
        await this.post({ content: chunks[i] });
        if (i < chunks.length - 1) await this.wait();
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
        content: `\`${timeStr}\` · Scan complete. No notable GPU deals this cycle. Monitoring continues.`,
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
