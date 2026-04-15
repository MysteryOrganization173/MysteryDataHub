import { AgentPricingRule } from '../models/AgentPricingRule.js';
import { AgentStoreSetting } from '../models/AgentStoreSetting.js';
import { User } from '../models/User.js';
import {
  getCatalogSnapshotPricing,
  getInternalCatalogItems,
  getNetworkMeta,
  getTierMeta
} from './catalog.service.js';
import {
  buildStoreLink,
  getFrontendBaseUrl,
  normalizeNetworkKey,
  normalizeTierKey,
  parsePositiveAmount,
  roundMoney,
  safeNumber,
  sanitizeText,
  toIdString
} from '../utils/agent.utils.js';

const NETWORK_ORDER = ['mtn', 'airteltigo', 'telecel'];
const TIER_ORDER = ['budget', 'express', 'instant', 'standard'];

function buildSettingKey(network, tier = '') {
  return tier ? `tier:${network}:${tier}` : `network:${network}`;
}

function createCatalogIndex(items) {
  const itemMap = new Map();
  items.forEach((item) => {
    itemMap.set(item.productKey, item);
  });
  return itemMap;
}

function getCurrentRetailPrice(rule) {
  const customRetailPrice = parsePositiveAmount(rule.customRetailPrice);
  const baseRetailPrice = customRetailPrice || parsePositiveAmount(rule.suggestedRetailPrice);
  return roundMoney(Math.max(baseRetailPrice, safeNumber(rule.floorPrice)));
}

function serializePricingRule(rule, catalogItem) {
  const networkMeta = getNetworkMeta(rule.network);
  const tierMeta = getTierMeta(rule.tier);
  const retailPrice = getCurrentRetailPrice(rule);
  const wholesaleCost = roundMoney(rule.wholesaleCost);
  const floorPrice = roundMoney(rule.floorPrice);
  const suggestedRetailPrice = roundMoney(rule.suggestedRetailPrice);

  return {
    id: toIdString(rule._id),
    productKey: rule.productKey,
    bundleCode: rule.bundleCode,
    network: rule.network,
    networkLabel: networkMeta?.label || catalogItem?.networkLabel || rule.network,
    tier: rule.tier,
    tierLabel: tierMeta?.label || catalogItem?.tierLabel || rule.tier,
    tierDescription: tierMeta?.description || catalogItem?.tierDescription || '',
    bundleSize: rule.bundleSize,
    sizeLabel: rule.sizeLabel || catalogItem?.sizeLabel || `${rule.bundleSize}GB`,
    validityLabel: rule.validityLabel || catalogItem?.validityLabel || '',
    deliveryLabel: rule.deliveryLabel || catalogItem?.deliveryLabel || '',
    wholesaleCost,
    floorPrice,
    suggestedRetailPrice,
    customRetailPrice: parsePositiveAmount(rule.customRetailPrice) || null,
    retailPrice,
    minProfit: roundMoney(Math.max(floorPrice - wholesaleCost, 0)),
    projectedProfit: roundMoney(Math.max(retailPrice - wholesaleCost, 0)),
    isActive: rule.isActive
  };
}

function groupProducts(products) {
  const grouped = [];

  NETWORK_ORDER.forEach((networkKey) => {
    const networkProducts = products.filter((product) => product.network === networkKey);
    if (!networkProducts.length) return;

    const tiers = [];
    TIER_ORDER.forEach((tierKey) => {
      const tierProducts = networkProducts.filter((product) => product.tier === tierKey);
      if (!tierProducts.length) return;

      const tierMeta = getTierMeta(tierKey);
      tiers.push({
        key: tierKey,
        label: tierMeta?.label || tierKey,
        description: tierMeta?.description || '',
        bundles: tierProducts
      });
    });

    const networkMeta = getNetworkMeta(networkKey);
    grouped.push({
      key: networkKey,
      label: networkMeta?.label || networkKey,
      tiers
    });
  });

  return grouped;
}

async function getStoreSettingMap(agentId) {
  const settings = await AgentStoreSetting.find({ agentId }).lean();
  const map = new Map();
  settings.forEach((setting) => {
    map.set(setting.settingKey, Boolean(setting.isEnabled));
  });
  return map;
}

function isStoreItemEnabled(settingsMap, product) {
  const networkKey = buildSettingKey(product.network);
  const tierKey = buildSettingKey(product.network, product.tier);
  const networkEnabled = settingsMap.has(networkKey) ? settingsMap.get(networkKey) : true;
  const tierEnabled = settingsMap.has(tierKey) ? settingsMap.get(tierKey) : true;
  return networkEnabled && tierEnabled;
}

export async function syncAgentPricingCatalog(agentId) {
  const catalogItems = await getInternalCatalogItems();
  if (!catalogItems.length) {
    return [];
  }

  const operations = catalogItems.map((item) => {
    const pricing = getCatalogSnapshotPricing(item);
    return {
      updateOne: {
        filter: { agentId, productKey: item.productKey },
        update: {
          $set: {
            bundleCode: item.bundleCode,
            network: item.network,
            tier: item.tier,
            bundleSize: item.volume,
            sizeLabel: item.sizeLabel,
            validityLabel: item.validityLabel,
            deliveryLabel: item.deliveryLabel,
            wholesaleCost: pricing.wholesaleCost,
            floorPrice: pricing.floorPrice,
            suggestedRetailPrice: pricing.suggestedRetailPrice,
            profitMargin: pricing.recommendedProfit
          },
          $setOnInsert: {
            isActive: true
          }
        },
        upsert: true
      }
    };
  });

  await AgentPricingRule.bulkWrite(operations, { ordered: false });
  return catalogItems;
}

export async function getAgentPricingView(agentId) {
  const catalogItems = await syncAgentPricingCatalog(agentId);
  const itemMap = createCatalogIndex(catalogItems);
  const productKeys = catalogItems.map((item) => item.productKey);
  const rules = await AgentPricingRule.find({ agentId, productKey: { $in: productKeys } })
    .sort({ network: 1, tier: 1, bundleSize: 1 });

  const products = rules.map((rule) => serializePricingRule(rule, itemMap.get(rule.productKey)));

  return {
    filters: {
      networks: NETWORK_ORDER
        .filter((networkKey) => products.some((product) => product.network === networkKey))
        .map((networkKey) => ({
          key: networkKey,
          label: getNetworkMeta(networkKey)?.label || networkKey
        })),
      tiers: TIER_ORDER
        .filter((tierKey) => products.some((product) => product.tier === tierKey))
        .map((tierKey) => ({
          key: tierKey,
          label: getTierMeta(tierKey)?.label || tierKey,
          description: getTierMeta(tierKey)?.description || ''
        }))
    },
    products,
    groups: groupProducts(products)
  };
}

export async function getAgentStoreSettingsView(agent) {
  const settingsMap = await getStoreSettingMap(agent._id);
  const networkSettings = NETWORK_ORDER.map((networkKey) => ({
    key: buildSettingKey(networkKey),
    network: networkKey,
    networkLabel: getNetworkMeta(networkKey)?.label || networkKey,
    isEnabled: settingsMap.has(buildSettingKey(networkKey)) ? settingsMap.get(buildSettingKey(networkKey)) : true
  }));
  const tierSettings = NETWORK_ORDER.flatMap((networkKey) =>
    TIER_ORDER.map((tierKey) => ({
      key: buildSettingKey(networkKey, tierKey),
      network: networkKey,
      networkLabel: getNetworkMeta(networkKey)?.label || networkKey,
      tier: tierKey,
      tierLabel: getTierMeta(tierKey)?.label || tierKey,
      isEnabled: settingsMap.has(buildSettingKey(networkKey, tierKey))
        ? settingsMap.get(buildSettingKey(networkKey, tierKey))
        : true
    }))
  );

  return {
    storeEnabled: Boolean(agent.storeEnabled),
    storeSlug: agent.storeSlug,
    storeLink: buildStoreLink(getFrontendBaseUrl(), agent.storeSlug),
    networkSettings,
    tierSettings,
    counts: {
      enabledNetworks: networkSettings.filter((entry) => entry.isEnabled).length,
      enabledTiers: tierSettings.filter((entry) => entry.isEnabled).length
    }
  };
}

export async function updateAgentStoreSettings(agentId, entries = []) {
  if (!Array.isArray(entries)) {
    return getAgentStoreSettingsView(await User.findById(agentId));
  }

  const operations = entries
    .map((entry) => {
      const network = normalizeNetworkKey(entry.network);
      const tier = normalizeTierKey(entry.tier);
      const isEnabled = typeof entry.isEnabled === 'boolean' ? entry.isEnabled : null;

      if (!network || isEnabled === null) {
        return null;
      }

      return {
        updateOne: {
          filter: { agentId, settingKey: buildSettingKey(network, tier) },
          update: {
            $set: {
              agentId,
              settingKey: buildSettingKey(network, tier),
              network,
              tier: tier || null,
              isEnabled
            }
          },
          upsert: true
        }
      };
    })
    .filter(Boolean);

  if (operations.length) {
    await AgentStoreSetting.bulkWrite(operations, { ordered: false });
  }

  const agent = await User.findById(agentId);
  return getAgentStoreSettingsView(agent);
}

export async function updateAgentStore(agent, payload = {}) {
  if (typeof payload.storeEnabled === 'boolean') {
    agent.storeEnabled = payload.storeEnabled;
  }

  if (payload.storeName) {
    agent.storeName = sanitizeText(payload.storeName, 80);
  }

  if (Number.isFinite(Number(payload.defaultMarkupPercent))) {
    agent.defaultMarkupPercent = Number(payload.defaultMarkupPercent);
  }

  await agent.save();
  return getAgentStoreSettingsView(agent);
}

export async function updateAgentPricingRule(agentId, ruleId, payload = {}) {
  const rule = await AgentPricingRule.findOne({ _id: ruleId, agentId });
  if (!rule) {
    return null;
  }

  if (payload.customRetailPrice !== undefined) {
    const nextRetail = parsePositiveAmount(payload.customRetailPrice);
    if (nextRetail && nextRetail < rule.floorPrice) {
      const error = new Error(`Retail price cannot be lower than ₵${rule.floorPrice.toFixed(2)}`);
      error.status = 400;
      throw error;
    }
    rule.customRetailPrice = nextRetail || undefined;
  }

  if (typeof payload.isActive === 'boolean') {
    rule.isActive = payload.isActive;
  }

  await rule.save();

  const catalogItems = await getInternalCatalogItems();
  const itemMap = createCatalogIndex(catalogItems);
  return serializePricingRule(rule, itemMap.get(rule.productKey));
}

export async function bulkUpdateAgentPricing(agentId, prices = []) {
  if (!Array.isArray(prices) || !prices.length) {
    return getAgentPricingView(agentId);
  }

  for (const entry of prices) {
    if (!entry?.id) continue;
    await updateAgentPricingRule(agentId, entry.id, entry);
  }

  return getAgentPricingView(agentId);
}

export async function resetAgentPricing(agentId, productKeys = []) {
  const filter = { agentId };
  if (Array.isArray(productKeys) && productKeys.length) {
    filter.productKey = { $in: productKeys.map((value) => String(value || '').trim()).filter(Boolean) };
  }

  await AgentPricingRule.updateMany(filter, { $unset: { customRetailPrice: 1 }, $set: { isActive: true } });
  return getAgentPricingView(agentId);
}

export async function getVisibleStoreProducts(agent) {
  const pricingView = await getAgentPricingView(agent._id);
  const settingsMap = await getStoreSettingMap(agent._id);

  return pricingView.products.filter((product) => product.isActive && isStoreItemEnabled(settingsMap, product));
}

export async function buildPublicStoreDataBySlug(storeSlug) {
  const normalizedSlug = String(storeSlug || '').trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const agent = await User.findOne({
    role: 'agent',
    storeSlug: normalizedSlug,
    agentStatus: 'active'
  }).select('-password');

  if (!agent || !agent.storeEnabled) {
    return null;
  }

  const products = await getVisibleStoreProducts(agent);
  if (!products.length) {
    return {
      agent: {
        id: toIdString(agent._id),
        fullName: agent.fullName,
        storeName: agent.storeName || `${agent.fullName}'s Store`,
        storeSlug: agent.storeSlug
      },
      store: {
        enabled: Boolean(agent.storeEnabled),
        link: buildStoreLink(getFrontendBaseUrl(), agent.storeSlug)
      },
      filters: { networks: [], tiers: [] },
      networks: [],
      products: []
    };
  }

  return {
    agent: {
      id: toIdString(agent._id),
      fullName: agent.fullName,
      storeName: agent.storeName || `${agent.fullName}'s Store`,
      storeSlug: agent.storeSlug
    },
    store: {
      enabled: Boolean(agent.storeEnabled),
      link: buildStoreLink(getFrontendBaseUrl(), agent.storeSlug)
    },
    filters: {
      networks: NETWORK_ORDER
        .filter((networkKey) => products.some((product) => product.network === networkKey))
        .map((networkKey) => ({
          key: networkKey,
          label: getNetworkMeta(networkKey)?.label || networkKey
        })),
      tiers: TIER_ORDER
        .filter((tierKey) => products.some((product) => product.tier === tierKey))
        .map((tierKey) => ({
          key: tierKey,
          label: getTierMeta(tierKey)?.label || tierKey
        }))
    },
    networks: groupProducts(products),
    products
  };
}

export async function resolveStorefrontSelection({ storeSlug, productKey, network, tier, volume }) {
  const store = await buildPublicStoreDataBySlug(storeSlug);
  if (!store) {
    return null;
  }

  const normalizedProductKey = String(productKey || '').trim().toLowerCase();
  const normalizedNetwork = normalizeNetworkKey(network);
  const normalizedTier = normalizeTierKey(tier);
  const normalizedVolume = safeNumber(volume);

  const product =
    store.products.find((entry) => entry.productKey === normalizedProductKey) ||
    store.products.find(
      (entry) =>
        entry.network === normalizedNetwork &&
        entry.tier === normalizedTier &&
        entry.bundleSize === normalizedVolume
    );

  if (!product) {
    return null;
  }

  return {
    agentId: store.agent.id,
    agentStoreSlug: store.agent.storeSlug,
    network: product.network,
    networkLabel: product.networkLabel,
    tier: product.tier,
    tierLabel: product.tierLabel,
    volume: product.bundleSize,
    sizeLabel: product.sizeLabel,
    validityLabel: product.validityLabel,
    bundleCode: product.bundleCode,
    bundleName: `${product.networkLabel} ${product.tierLabel} ${product.sizeLabel}`,
    deliveryLabel: product.deliveryLabel,
    productKey: product.productKey,
    wholesaleCost: product.wholesaleCost,
    floorPrice: product.floorPrice,
    suggestedRetailPrice: product.suggestedRetailPrice,
    price: product.retailPrice
  };
}
