import { roundMoney } from '../utils/agent.utils.js';

// ---- Source-of-truth platform inputs ----
export const MTN_BUDGET_COST_PER_GB = 4.10;
export const MTN_EXPRESS_COST_PER_GB = 4.70;
export const AIRTELTIGO_COST_PER_GB = 3.85;

export const PLATFORM_MARGIN_PER_GB = 0.30;
export const MIN_AGENT_MARGIN = 0.20;

// Customer-facing targets (main site)
export const MTN_BUDGET_CUSTOMER_PER_GB = 4.79;
export const MTN_EXPRESS_CUSTOMER_PER_GB = 5.99;
export const AIRTELTIGO_CUSTOMER_PER_GB = 4.49;

// Telecel customer ranges (must be reflected by catalog price)
const TELECEL_CUSTOMER_10GB_MIN = 42;
const TELECEL_CUSTOMER_10GB_MAX = 45;
const TELECEL_CUSTOMER_20GB_MIN = 79;
const TELECEL_CUSTOMER_20GB_MAX = 83;

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return value;
  if (min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }
  return Math.min(Math.max(value, min), max);
}

function linearInterpolate(x, x0, y0, x1, y1) {
  if (!Number.isFinite(x)) return y0;
  if (x1 === x0) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

export function telecelPlatformMarginForBundle(volumeGb) {
  const v = Number(volumeGb);
  // Fixed margin per bundle: 10GB => +3, 20GB => +5 (scale proportionally)
  const margin = linearInterpolate(v, 10, 3, 20, 5);
  return roundMoney(margin);
}

export function telecelAllowedCustomerPriceRange(volumeGb) {
  const v = Number(volumeGb);

  const min = linearInterpolate(v, 10, TELECEL_CUSTOMER_10GB_MIN, 20, TELECEL_CUSTOMER_20GB_MIN);
  const max = linearInterpolate(v, 10, TELECEL_CUSTOMER_10GB_MAX, 20, TELECEL_CUSTOMER_20GB_MAX);

  return {
    min: roundMoney(Math.min(min, max)),
    max: roundMoney(Math.max(min, max))
  };
}

export function getProviderCostTotal({ network, tier, volumeGb, telecelProviderCost }) {
  const volume = Number(volumeGb);
  if (!Number.isFinite(volume) || volume <= 0) return null;

  if (network === 'telecel') {
    const raw = Number(telecelProviderCost);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return roundMoney(raw);
  }

  if (network === 'mtn' && tier === 'budget') {
    return roundMoney(MTN_BUDGET_COST_PER_GB * volume);
  }
  if (network === 'mtn' && tier === 'express') {
    return roundMoney(MTN_EXPRESS_COST_PER_GB * volume);
  }

  if (network === 'airteltigo') {
    return roundMoney(AIRTELTIGO_COST_PER_GB * volume);
  }

  return null;
}

export function getAgentBasePriceTotal({ network, tier, volumeGb, telecelProviderCost }) {
  // Base (agent) price = provider cost + platform margin
  const providerCost = getProviderCostTotal({ network, tier, volumeGb, telecelProviderCost });
  if (providerCost === null) return null;

  if (network === 'telecel') {
    const platformMargin = telecelPlatformMarginForBundle(volumeGb);
    return roundMoney(providerCost + platformMargin);
  }

  const platformMargin = roundMoney(PLATFORM_MARGIN_PER_GB * Number(volumeGb));
  return roundMoney(providerCost + platformMargin);
}

export function getAgentFloorPriceTotal({ network, tier, volumeGb, telecelProviderCost }) {
  const basePrice = getAgentBasePriceTotal({ network, tier, volumeGb, telecelProviderCost });
  if (basePrice === null) return null;
  return roundMoney(basePrice + MIN_AGENT_MARGIN);
}

export function getCustomerPriceTotal({ network, tier, volumeGb, telecelProviderCost }) {
  const volume = Number(volumeGb);
  const providerCost = getProviderCostTotal({ network, tier, volumeGb, telecelProviderCost });
  if (providerCost === null) return null;

  if (network === 'telecel') {
    const basePrice = getAgentBasePriceTotal({ network, tier, volumeGb, telecelProviderCost });
    if (basePrice === null) return null;

    const candidate = roundMoney(basePrice + MIN_AGENT_MARGIN);
    const allowed = telecelAllowedCustomerPriceRange(volumeGb);
    // Prefer staying within the requested competitive band, while never going below basePrice.
    const low = roundMoney(Math.max(basePrice, allowed.min));
    const high = allowed.max;
    if (low > high) return low;
    return roundMoney(clamp(candidate, low, high));
  }

  const perGb =
    network === 'mtn' && tier === 'budget'
      ? MTN_BUDGET_CUSTOMER_PER_GB
      : network === 'mtn' && tier === 'express'
        ? MTN_EXPRESS_CUSTOMER_PER_GB
        : network === 'airteltigo'
          ? AIRTELTIGO_CUSTOMER_PER_GB
          : null;

  if (!Number.isFinite(Number(perGb))) return null;

  const customerPrice = roundMoney(Number(perGb) * volume);

  // Enforce a safe minimum customer price: base + MIN_AGENT_MARGIN.
  const basePrice = getAgentBasePriceTotal({ network, tier, volumeGb, telecelProviderCost });
  if (basePrice === null) return null;
  const minCustomerPrice = roundMoney(basePrice + MIN_AGENT_MARGIN);
  return roundMoney(Math.max(customerPrice, minCustomerPrice));
}

