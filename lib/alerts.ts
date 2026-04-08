/**
 * Alert rules engine.
 * Evaluates GPU listings and leads against rules,
 * fires Discord alerts for high-value finds.
 */

import axios from 'axios';
import type { GpuListing, CompanyLead } from './types';
import { getSupabase } from './supabase';

export interface Alert {
  type: 'bulk_lot' | 'high_value_gpu' | 'price_drop' | 'new_company';
  title: string;
  message: string;
  link: string;
  priority: 'urgent' | 'high' | 'medium';
  listing?: GpuListing;
  lead?: CompanyLead;
}

// ─── Alert Rules ─────────────────────────────────────────

const HIGH_VALUE_MODELS = ['H200', 'H100', 'B200', 'A100', 'L40S', 'L40', 'A6000'];
const TARGET_MODELS = ['RTX 5090', 'RTX 4090', 'RTX 5080', 'RTX 4080', ...HIGH_VALUE_MODELS];

const PRICE_THRESHOLDS: Record<string, number> = {
  'RTX 4090': 1200,
  'RTX 5090': 1800,
  'RTX 3090': 600,
  'RTX 4080': 800,
  'RTX 5080': 900,
  'A100': 5000,
  'H100': 15000,
  'A6000': 2000,
  'L40': 4000,
};

export function evaluateAlerts(listings: GpuListing[], leads: CompanyLead[]): Alert[] {
  const alerts: Alert[] = [];

  for (const l of listings) {
    // Rule 1: Bulk lot (qty >= 4)
    if (l.quantity >= 4) {
      alerts.push({
        type: 'bulk_lot',
        title: `Bulk Lot: ${l.quantity}x ${l.gpuModel}`,
        message: `${l.quantity} units of ${l.gpuModel} found at ${l.price > 0 ? `$${l.pricePerUnit.toLocaleString()}/unit` : 'price TBD'} from ${l.seller} (${l.source})`,
        link: l.link,
        priority: l.quantity >= 10 ? 'urgent' : 'high',
        listing: l,
      });
    }

    // Rule 2: High-value datacenter GPU
    if (HIGH_VALUE_MODELS.some(m => l.gpuModel.includes(m))) {
      alerts.push({
        type: 'high_value_gpu',
        title: `Datacenter GPU: ${l.gpuModel}`,
        message: `${l.gpuModel} ${l.quantity > 1 ? `(${l.quantity}x)` : ''} at ${l.price > 0 ? `$${l.price.toLocaleString()}` : 'price TBD'} — ${l.condition} from ${l.seller}`,
        link: l.link,
        priority: 'urgent',
        listing: l,
      });
    }

    // Rule 3: Price below threshold
    if (l.pricePerUnit > 0) {
      for (const [model, threshold] of Object.entries(PRICE_THRESHOLDS)) {
        if (l.gpuModel.includes(model) && l.pricePerUnit < threshold) {
          alerts.push({
            type: 'price_drop',
            title: `Below Market: ${l.gpuModel} at $${l.pricePerUnit.toLocaleString()}`,
            message: `${l.gpuModel} priced at $${l.pricePerUnit.toLocaleString()}/unit (threshold: $${threshold.toLocaleString()}) — ${l.condition} from ${l.seller}`,
            link: l.link,
            priority: l.pricePerUnit < threshold * 0.7 ? 'urgent' : 'high',
            listing: l,
          });
          break;
        }
      }
    }

    // Rule 4: Target model with bulk signal in title
    const titleLower = l.title.toLowerCase();
    if (TARGET_MODELS.some(m => l.gpuModel.includes(m)) &&
        (titleLower.includes('lot') || titleLower.includes('bulk') || titleLower.includes('wholesale') ||
         titleLower.includes('liquidation') || titleLower.includes('decommission') || titleLower.includes('server pull'))) {
      // Only add if not already caught by other rules
      if (!alerts.find(a => a.link === l.link)) {
        alerts.push({
          type: 'bulk_lot',
          title: `Deal Signal: ${l.gpuModel}`,
          message: `${l.title.slice(0, 100)} — $${l.price > 0 ? l.price.toLocaleString() : 'TBD'} from ${l.seller}`,
          link: l.link,
          priority: 'high',
          listing: l,
        });
      }
    }
  }

  // Rule 5: New ITAD/Liquidator company
  for (const lead of leads) {
    if (lead.priority === 'High' && (lead.type === 'ITAD' || lead.type === 'Liquidator' || lead.type === 'Wholesale')) {
      alerts.push({
        type: 'new_company',
        title: `New ${lead.type}: ${lead.company}`,
        message: `${lead.company} — ${lead.description.slice(0, 100)}. GPUs: ${lead.gpuModels}. Location: ${lead.location}`,
        link: lead.website,
        priority: 'high',
        lead,
      });
    }
  }

  // Dedup by link
  const seen = new Set<string>();
  const deduped = alerts.filter(a => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  // Sort: urgent first, then high, then medium
  const priorityOrder = { urgent: 3, high: 2, medium: 1 };
  deduped.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

  return deduped;
}

// ─── Save alerts to Supabase ─────────────────────────────

export async function saveAlerts(alerts: Alert[]) {
  if (!alerts.length) return;

  const sb = getSupabase();

  // Check which alerts already exist (dedup by link)
  const links = alerts.map(a => a.link).filter(Boolean);
  const { data: existing } = await sb
    .from('alerts')
    .select('link')
    .in('link', links);

  const existingLinks = new Set((existing || []).map(r => r.link));

  const newAlerts = alerts
    .filter(a => !existingLinks.has(a.link))
    .map(a => ({
      type: a.type,
      title: a.title,
      message: a.message,
      link: a.link,
      priority: a.priority,
      sent: false,
      created_at: new Date().toISOString(),
    }));

  if (newAlerts.length > 0) {
    const { error } = await sb.from('alerts').insert(newAlerts);
    if (error) console.error('[Alerts] Save error:', error.message);
    else console.log(`[Alerts] Saved ${newAlerts.length} new alerts`);
  } else {
    console.log('[Alerts] No new alerts (all duplicates)');
  }

  return newAlerts.length;
}

// ─── Send alerts to Discord ──────────────────────────────

export async function sendAlertToDiscord(alerts: Alert[]) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !alerts.length) return;

  const urgentAlerts = alerts.filter(a => a.priority === 'urgent');
  const highAlerts = alerts.filter(a => a.priority === 'high');

  if (urgentAlerts.length === 0 && highAlerts.length === 0) return;

  let msg = `🚨 **GPU Alert — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}**\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Urgent alerts
  if (urgentAlerts.length > 0) {
    msg += `🔴 **URGENT**\n\n`;
    for (const a of urgentAlerts.slice(0, 5)) {
      msg += `**${a.title}**\n`;
      msg += `${a.message}\n`;
      if (a.link) msg += `${a.link.startsWith('http') ? a.link : `https://${a.link}`}\n`;
      msg += '\n';
    }
  }

  // High alerts
  if (highAlerts.length > 0) {
    msg += `🟡 **HIGH PRIORITY**\n\n`;
    for (const a of highAlerts.slice(0, 5)) {
      msg += `**${a.title}**\n`;
      msg += `${a.message}\n`;
      if (a.link) msg += `${a.link.startsWith('http') ? a.link : `https://${a.link}`}\n`;
      msg += '\n';
    }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_${alerts.length} alert${alerts.length > 1 ? 's' : ''} triggered · Act fast on urgent items_`;

  // Split if too long
  if (msg.length <= 2000) {
    await axios.post(webhookUrl, { content: msg });
  } else {
    const mid = msg.lastIndexOf('\n\n', 1800);
    await axios.post(webhookUrl, { content: msg.slice(0, mid) });
    await new Promise(r => setTimeout(r, 1500));
    await axios.post(webhookUrl, { content: msg.slice(mid + 2) });
  }

  console.log(`[Alerts] Sent ${urgentAlerts.length} urgent + ${highAlerts.length} high alerts to Discord`);
}
