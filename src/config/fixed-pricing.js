import { roundMoney } from '../utils/agent.utils.js';

// Single source of truth for customer-facing prices.
// Keys are normalized to match catalog keys: network: mtn|airteltigo|telecel, tier: budget|express|instant|standard.
// Bundle sizes use the form "1GB", "2GB", etc.
export const FIXED_PRICING = {
  mtn: {
    budget: {
      '1GB': 4.79,
      '2GB': 9.5
    },
    express: {
      '1GB': 5.99
    }
  }
  // airteltigo: { instant: { '1GB': 0 }, standard: { '10GB': 0 } },
  // telecel: { standard: { '1GB': 0 } }
};

export function getFixedCatalogPrice({ network, tier, volume }) {
  const networkKey = String(network || '').trim().toLowerCase();
  const tierKey = String(tier || '').trim().toLowerCase();
  const sizeKey = `${Number(volume)}GB`;

  const raw = FIXED_PRICING?.[networkKey]?.[tierKey]?.[sizeKey];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? roundMoney(value) : null;
}

