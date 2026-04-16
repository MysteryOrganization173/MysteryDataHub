import { Bundle } from '../models/Bundle.js';
import { roundMoney } from '../utils/agent.utils.js';

// ---- Source of truth costs (Success Biz Hub) ----
// MTN / Airtel are per-GB costs.
export const MTN_BUDGET_COST_PER_GB = 4.10;
export const MTN_EXPRESS_COST_PER_GB = 4.70;
export const AIRTELTIGO_COST_PER_GB = 3.85;

// Telecel is NOT per-GB. Telecel wholesale cost is stored per bundle in catalog data (bundle.wholesalePrice).

// ---- Platform margin rules ----
export const PLATFORM_MARGIN_PER_GB = 0.30;
export const MIN_AGENT_MARGIN = 0.20;

function getTelecelPlatformMarginForVolume(volumeGb) {
  const v = Number(volumeGb);
  if (!Number.isFinite(v) || v <= 0) return 0;

  // Telecel margin is bundle-based:
  // - 10GB: +3
  // - 20GB: +5
  // Scale linearly between these points.
  const margin = 3 + ((v - 10) / (20 - 10)) * (5 - 3);
  return roundMoney(margin);
}

async function getWholesaleCostTotal({ network, tier, volumeGb, bundle }) {
  const v = Number(volumeGb);
  if (!Number.isFinite(v) || v <= 0) return 0;

  if (network === 'mtn') {
    const costPerGb = tier === 'express' ? MTN_EXPRESS_COST_PER_GB : MTN_BUDGET_COST_PER_GB; // budget default
    return roundMoney(costPerGb * v);
  }

  if (network === 'airteltigo') {
    return roundMoney(AIRTELTIGO_COST_PER_GB * v);
  }

  if (network === 'telecel') {
    // Telecel is bundle-based pricing. Wholesale cost is supplied by catalog bundle data.
    const resolvedBundle = bundle
      ? bundle
      : await Bundle.findOne({ code: bundle?.code }).lean();

    const cost = Number(
      resolvedBundle?.wholesalePrice ??
        resolvedBundle?.basePrice ??
        resolvedBundle?.defaultAgentPrice ??
        0
    );
    return roundMoney(cost);
  }

  return 0;
}

export async function computePricingForCatalogItem({
  network,
  tier,
  volumeGb,
  bundle
}) {
  const normalizedNetwork = String(network || '').trim().toLowerCase();
  const normalizedTier = String(tier || '').trim().toLowerCase();
  const v = Number(volumeGb);

  if (!normalizedNetwork || !Number.isFinite(v) || v <= 0) {
    return null;
  }

  const wholesaleCost = await getWholesaleCostTotal({
    network: normalizedNetwork,
    tier: normalizedTier,
    volumeGb: v,
    bundle
  });

  if (!Number.isFinite(wholesaleCost) || wholesaleCost <= 0) {
    return null;
  }

  // Platform margin (total for this bundle)
  const platformMarginTotal = normalizedNetwork === 'telecel'
    ? getTelecelPlatformMarginForVolume(v)
    : roundMoney(PLATFORM_MARGIN_PER_GB * v);

  const agentBasePriceTotal = roundMoney(wholesaleCost + platformMarginTotal);
  const agentMinAllowedRetailPriceTotal = roundMoney(agentBasePriceTotal + MIN_AGENT_MARGIN);

  // Customer retail price (main site) rules
  let customerRetailPriceTotal = 0;
  if (normalizedNetwork === 'telecel') {
    // Customer price for telecel is cost + telecel platform margin (bundle-based),
    // and must fall within Success Biz Hub-aligned ranges (10GB and 20GB are the reference points).
    customerRetailPriceTotal = roundMoney(wholesaleCost + platformMarginTotal);
  } else if (normalizedNetwork === 'mtn') {
    const perGb = normalizedTier === 'express' ? 5.79 : 4.79; // MTN Budget default
    customerRetailPriceTotal = roundMoney(perGb * v);
  } else if (normalizedNetwork === 'airteltigo') {
    customerRetailPriceTotal = roundMoney(4.49 * v);
  }

  return {
    wholesaleCost,
    floorPrice: agentMinAllowedRetailPriceTotal,
    suggestedRetailPrice: customerRetailPriceTotal,
    publicPrice: customerRetailPriceTotal,
    price: customerRetailPriceTotal
  };
}

export async function computeAgentMinimumAllowedRetailPriceTotal({
  network,
  tier,
  volumeGb,
  bundle,
  bundleCode
}) {
  const resolvedBundle = bundle || (bundleCode ? await Bundle.findOne({ code: bundleCode }).lean() : null);
  const pricing = await computePricingForCatalogItem({
    network,
    tier,
    volumeGb,
    bundle: resolvedBundle
  });

  return pricing?.floorPrice ?? 0;
}

