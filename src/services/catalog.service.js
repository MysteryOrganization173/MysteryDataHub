import { Bundle } from '../models/Bundle.js';

const NETWORK_META = {
  mtn: { key: 'mtn', label: 'MTN' },
  airteltigo: { key: 'airteltigo', label: 'AirtelTigo' },
  telecel: { key: 'telecel', label: 'Telecel' }
};

const TIER_META = {
  express: {
    key: 'express',
    label: 'Express',
    description: 'Premium speed with faster delivery labels where supported.'
  },
  beneficiary: {
    key: 'beneficiary',
    label: 'Beneficiary',
    description: 'Budget-friendly pricing built from backend-only validated products.'
  }
};

const PROVIDER_OFFER_MATRIX = {
  mtn: {
    express: {
      offerSlug: 'mtn_express_bundle',
      deliveryLabel: '5-45min',
      allowedVolumes: [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40]
    },
    beneficiary: {
      offerSlug: 'master_beneficiary_bundle',
      deliveryLabel: '5-45min',
      allowedVolumes: [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40]
    }
  },
  airteltigo: {
    express: {
      offerSlug: 'ishare_data_bundle',
      deliveryLabel: 'Instant',
      allowedVolumes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30]
    }
  },
  telecel: {
    express: {
      offerSlug: 'telecel_expiry_bundle',
      deliveryLabel: '5-45min',
      allowedVolumes: [10, 15, 20, 25, 30, 40, 50, 100]
    }
  }
};

function isBundleStoreReady() {
  return Bundle?.db?.readyState === 1;
}

function roundMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function parseVolumeGb(size) {
  const amount = Number.parseFloat(String(size || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

function normalizeNetwork(value) {
  const network = String(value || '').trim().toLowerCase();
  return NETWORK_META[network] ? network : null;
}

function normalizeTier(value) {
  const tier = String(value || '').trim().toLowerCase();
  return TIER_META[tier] ? tier : null;
}

function normalizeVolume(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function isBundleEligibleForTier(bundle, network, tier) {
  if (!bundle || bundle.operator !== network || bundle.active === false) {
    return false;
  }

  if (network === 'airteltigo') {
    if (tier !== 'express') return false;
    return Boolean(bundle.isInstant);
  }

  if (tier === 'beneficiary' && network !== 'mtn') {
    return false;
  }

  return !bundle.isBigTime;
}

function getTierPrice(bundle, tier) {
  if (tier === 'express') {
    return roundMoney(bundle.defaultAgentPrice);
  }

  if (tier === 'beneficiary') {
    const beneficiaryPrice = roundMoney(bundle.wholesalePrice ?? bundle.basePrice);
    const expressPrice = roundMoney(bundle.defaultAgentPrice);
    if (!beneficiaryPrice) return null;
    if (expressPrice && beneficiaryPrice >= expressPrice) return null;
    return beneficiaryPrice;
  }

  return null;
}

function getDeliveryLabel(bundle, offerConfig) {
  const label = String(bundle?.deliveryTime || '').trim();
  return label || offerConfig.deliveryLabel;
}

function buildCatalogItem(bundle, network, tier) {
  const offerConfig = PROVIDER_OFFER_MATRIX[network]?.[tier];
  if (!offerConfig || !isBundleEligibleForTier(bundle, network, tier)) {
    return null;
  }

  const volume = parseVolumeGb(bundle.size);
  if (!volume || !offerConfig.allowedVolumes.includes(volume)) {
    return null;
  }

  const price = getTierPrice(bundle, tier);
  if (!price) {
    return null;
  }

  return {
    network,
    networkLabel: NETWORK_META[network].label,
    tier,
    tierLabel: TIER_META[tier].label,
    tierDescription: TIER_META[tier].description,
    volume,
    sizeLabel: `${volume}GB`,
    price,
    currency: 'GHS',
    deliveryLabel: getDeliveryLabel(bundle, offerConfig),
    offerSlug: offerConfig.offerSlug,
    bundleCode: bundle.code,
    productKey: `${network}:${tier}:${volume}`
  };
}

function sortCatalogItems(left, right) {
  return left.volume - right.volume;
}

function toPublicItem(item) {
  return {
    productKey: item.productKey,
    network: item.network,
    networkLabel: item.networkLabel,
    tier: item.tier,
    tierLabel: item.tierLabel,
    tierDescription: item.tierDescription,
    volume: item.volume,
    sizeLabel: item.sizeLabel,
    price: item.price,
    currency: item.currency,
    deliveryLabel: item.deliveryLabel
  };
}

async function buildInternalCatalog() {
  let bundles = [];
  if (isBundleStoreReady()) {
    try {
      bundles = await Bundle.find({ active: true }).lean();
    } catch (error) {
      console.error('[catalog.service] failed to load bundles:', error.message);
      bundles = [];
    }
  }
  const networks = [];
  const flatItems = [];

  Object.keys(NETWORK_META).forEach((network) => {
    const tierEntries = [];

    Object.keys(TIER_META).forEach((tier) => {
      const providerTier = PROVIDER_OFFER_MATRIX[network]?.[tier];
      if (!providerTier) return;

      const items = bundles
        .map((bundle) => buildCatalogItem(bundle, network, tier))
        .filter(Boolean)
        .sort(sortCatalogItems);

      if (!items.length) {
        return;
      }

      tierEntries.push({
        key: tier,
        label: TIER_META[tier].label,
        description: TIER_META[tier].description,
        bundles: items.map(toPublicItem)
      });

      flatItems.push(...items);
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
    internalItems: flatItems
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

export async function resolveCatalogSelection({ network, tier, volume }) {
  const normalizedNetwork = normalizeNetwork(network);
  const normalizedTier = normalizeTier(tier);
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

export async function resolveLegacyBundleSelection(bundleCode) {
  if (!isBundleStoreReady()) {
    return null;
  }

  let bundle = null;
  try {
    bundle = await Bundle.findOne({ code: bundleCode, active: true }).lean();
  } catch (error) {
    console.error('[catalog.service] failed to resolve legacy bundle:', error.message);
    return null;
  }

  if (!bundle) {
    return null;
  }

  const network = normalizeNetwork(bundle.operator);
  if (!network) {
    return null;
  }

  return buildCatalogItem(bundle, network, 'express');
}
