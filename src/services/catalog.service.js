import { Bundle } from '../models/Bundle.js';
import {
  normalizeNetworkKey,
  normalizeTierKey,
  parseVolumeGb,
  roundMoney
} from '../utils/agent.utils.js';
import {
  getAgentBasePriceTotal,
  getAgentFloorPriceTotal,
  getCustomerPriceTotal
} from './pricing-calculator.service.js';

export const NETWORK_META = {
  mtn: { key: 'mtn', label: 'MTN' },
  airteltigo: { key: 'airteltigo', label: 'AirtelTigo' },
  telecel: { key: 'telecel', label: 'Telecel' }
};

export const TIER_META = {
  budget: {
    key: 'budget',
    label: 'Budget',
    description: 'Affordable MTN bundles at great rates.'
  },
  express: {
    key: 'express',
    label: 'Express',
    description: 'Faster MTN bundles with priority delivery.'
  },
  instant: {
    key: 'instant',
    label: 'Instant',
    description: 'AirtelTigo iShare bundles for fast top-ups.'
  },
  standard: {
    key: 'standard',
    label: 'Standard',
    description: 'Standard bundles where the network supports them.'
  }
};

const NETWORK_OFFER_CONFIG = {
  mtn: [
    {
      key: 'budget',
      offerSlug: 'master_beneficiary_bundle',
      deliveryLabel: '5-45min',
      preferredEnding: 0.49,
      eligibility: (bundle) => !bundle.isBigTime
    },
    {
      key: 'express',
      offerSlug: 'mtn_express_bundle',
      deliveryLabel: '5-45min',
      preferredEnding: 0.99,
      eligibility: (bundle) => !bundle.isBigTime
    }
  ],
  airteltigo: [
    {
      key: 'instant',
      offerSlug: 'ishare_data_bundle',
      deliveryLabel: 'Instant',
      preferredEnding: 0.49,
      eligibility: (bundle) => Boolean(bundle.isInstant)
    },
    {
      key: 'standard',
      offerSlug: 'bigtime_data_bundle',
      deliveryLabel: 'Non-expiry',
      preferredEnding: 0.79,
      eligibility: (bundle) => Boolean(bundle.isBigTime)
    }
  ],
  telecel: [
    {
      key: 'standard',
      offerSlug: 'telecel_expiry_bundle',
      deliveryLabel: 'Expiry',
      preferredEnding: 0.79,
      eligibility: (bundle) => bundle.active !== false
    }
  ]
};

function isBundleStoreReady() {
  return Bundle?.db?.readyState === 1;
}

function normalizeVolume(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function getTelecelProviderCost(bundle) {
  // Telecel cost is bundle-based (not per-GB). We rely on the catalog/DB cost fields.
  return roundMoney(bundle.wholesalePrice || bundle.basePrice || bundle.defaultAgentPrice || 0);
}

// Catalog pricing is sourced exclusively from FIXED_PRICING.

function getDeliveryLabel(bundle, offerConfig) {
  const delivery = String(bundle?.deliveryTime || '').trim();
  if (offerConfig.key === 'instant') return 'Instant';
  if (offerConfig.key === 'standard' && bundle.operator === 'airteltigo') return 'Non-expiry';
  if (offerConfig.key === 'standard' && bundle.operator === 'telecel') return 'Expiry';
  return delivery || offerConfig.deliveryLabel;
}

function buildCatalogItem(bundle, network, offerConfig) {
  if (!bundle || bundle.operator !== network || bundle.active === false) {
    return null;
  }
  if (!offerConfig.eligibility(bundle)) {
    return null;
  }

  const volume = parseVolumeGb(bundle.size);
  if (!volume) {
    return null;
  }

  const telecelProviderCost = network === 'telecel' ? getTelecelProviderCost(bundle) : null;

  const wholesaleCost = getAgentBasePriceTotal({
    network,
    tier: offerConfig.key,
    volumeGb: volume,
    telecelProviderCost
  });
  if (!wholesaleCost) return null;

  const floorPrice = getAgentFloorPriceTotal({
    network,
    tier: offerConfig.key,
    volumeGb: volume,
    telecelProviderCost
  });
  if (!floorPrice) return null;

  const customerPrice = getCustomerPriceTotal({
    network,
    tier: offerConfig.key,
    volumeGb: volume,
    telecelProviderCost
  });

  if (!customerPrice) return null;

  const tierMeta = TIER_META[offerConfig.key];
  const networkMeta = NETWORK_META[network];

  return {
    network,
    networkLabel: networkMeta.label,
    tier: offerConfig.key,
    tierLabel: tierMeta.label,
    tierDescription: tierMeta.description,
    volume,
    sizeLabel: `${volume}GB`,
    validityLabel: bundle.validity,
    price: customerPrice,
    publicPrice: customerPrice,
    wholesaleCost,
    floorPrice,
    suggestedRetailPrice: roundMoney(Math.max(customerPrice, floorPrice)),
    currency: 'GHS',
    deliveryLabel: getDeliveryLabel(bundle, offerConfig),
    offerSlug: offerConfig.offerSlug,
    bundleCode: bundle.code,
    bundleName: bundle.name,
    productKey: `${network}:${offerConfig.key}:${volume}`
  };
}

function sortCatalogItems(left, right) {
  return left.volume - right.volume;
}

function toPublicItem(item) {
  return {
    productKey: item.productKey,
    bundleCode: item.bundleCode,
    network: item.network,
    networkLabel: item.networkLabel,
    tier: item.tier,
    tierLabel: item.tierLabel,
    tierDescription: item.tierDescription,
    volume: item.volume,
    sizeLabel: item.sizeLabel,
    validityLabel: item.validityLabel,
    price: item.publicPrice,
    currency: item.currency,
    deliveryLabel: item.deliveryLabel
  };
}

async function loadActiveBundles() {
  if (!isBundleStoreReady()) {
    return [];
  }

  try {
    return await Bundle.find({ active: true }).lean();
  } catch (error) {
    console.error('[catalog.service] failed to load bundles:', error.message);
    return [];
  }
}

async function buildInternalCatalog() {
  const bundles = await loadActiveBundles();
  const networks = [];
  const flatMap = new Map();

  Object.entries(NETWORK_OFFER_CONFIG).forEach(([network, offerConfigs]) => {
    const tierEntries = [];

    offerConfigs.forEach((offerConfig) => {
      const items = bundles
        .map((bundle) => buildCatalogItem(bundle, network, offerConfig))
        .filter(Boolean)
        .sort(sortCatalogItems);

      if (!items.length) {
        return;
      }

      items.forEach((item) => {
        const current = flatMap.get(item.productKey);
        if (!current || current.publicPrice > item.publicPrice) {
          flatMap.set(item.productKey, item);
        }
      });

      tierEntries.push({
        key: offerConfig.key,
        label: TIER_META[offerConfig.key].label,
        description: TIER_META[offerConfig.key].description,
        bundles: items.map(toPublicItem)
      });
    });

    if (!tierEntries.length) {
      return;
    }

    networks.push({
      key: network,
      label: NETWORK_META[network].label,
      tiers: tierEntries
    });
  });

  const internalItems = Array.from(flatMap.values()).sort((left, right) => {
    if (left.network !== right.network) {
      return left.network.localeCompare(right.network);
    }
    if (left.tier !== right.tier) {
      return left.tier.localeCompare(right.tier);
    }
    return left.volume - right.volume;
  });

  const availableTierKeys = Object.keys(TIER_META).filter((tier) =>
    networks.some((network) => network.tiers.some((entry) => entry.key === tier))
  );

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      networks: networks.map((network) => ({ key: network.key, label: network.label })),
      tiers: availableTierKeys.map((tier) => ({
        key: tier,
        label: TIER_META[tier].label,
        description: TIER_META[tier].description
      }))
    },
    networks,
    internalItems
  };
}

export async function getCatalogResponse() {
  const catalog = await buildInternalCatalog();
  return {
    generatedAt: catalog.generatedAt,
    filters: catalog.filters,
    networks: catalog.networks
  };
}

export async function getInternalCatalogItems() {
  const catalog = await buildInternalCatalog();
  return catalog.internalItems;
}

export async function resolveCatalogSelection({ network, tier, volume }) {
  const normalizedNetwork = normalizeNetworkKey(network);
  const normalizedTier = normalizeTierKey(tier);
  const normalizedVolume = normalizeVolume(volume);

  if (!normalizedNetwork || !normalizedTier || !normalizedVolume) {
    return null;
  }

  const catalog = await buildInternalCatalog();
  return (
    catalog.internalItems.find(
      (item) =>
        item.network === normalizedNetwork &&
        item.tier === normalizedTier &&
        item.volume === normalizedVolume
    ) || null
  );
}

export async function resolveProductKeySelection(productKey) {
  const normalizedKey = String(productKey || '').trim().toLowerCase();
  if (!normalizedKey) {
    return null;
  }

  const catalog = await buildInternalCatalog();
  return catalog.internalItems.find((item) => item.productKey === normalizedKey) || null;
}

export async function resolveLegacyBundleSelection(bundleCode) {
  const code = String(bundleCode || '').trim();
  if (!code || !isBundleStoreReady()) {
    return null;
  }

  let bundle = null;
  try {
    bundle = await Bundle.findOne({ code, active: true }).lean();
  } catch (error) {
    console.error('[catalog.service] failed to resolve legacy bundle:', error.message);
    return null;
  }

  if (!bundle) {
    return null;
  }

  const network = normalizeNetworkKey(bundle.operator);
  const offerConfigs = NETWORK_OFFER_CONFIG[network] || [];
  const defaultConfig =
    offerConfigs.find((config) => config.key === 'express') ||
    offerConfigs.find((config) => config.eligibility(bundle)) ||
    offerConfigs[0];

  return defaultConfig ? buildCatalogItem(bundle, network, defaultConfig) : null;
}

export function getTierMeta(tierKey) {
  return TIER_META[normalizeTierKey(tierKey)] || null;
}

export function getNetworkMeta(networkKey) {
  return NETWORK_META[normalizeNetworkKey(networkKey)] || null;
}

export function getCatalogSnapshotPricing(item) {
  if (!item) return null;
  const wholesaleCost = roundMoney(item.wholesaleCost);
  const floorPrice = roundMoney(item.floorPrice);
  const suggestedRetailPrice = roundMoney(item.suggestedRetailPrice);
  const publicPrice = roundMoney(item.publicPrice ?? item.price);

  return {
    wholesaleCost,
    floorPrice,
    suggestedRetailPrice,
    publicPrice,
    minProfit: roundMoney(Math.max(floorPrice - wholesaleCost, 0)),
    recommendedProfit: roundMoney(Math.max(suggestedRetailPrice - wholesaleCost, 0)),
    currentPublicProfit: roundMoney(Math.max(publicPrice - wholesaleCost, 0))
  };
}
