import { AppSetting } from '../models/AppSetting.js';
import {
  AGENT_MIN_WITHDRAWAL_GHS,
  parsePositiveAmount,
  roundMoney,
  sanitizeText
} from '../utils/agent.utils.js';

const NETWORK_STATUS_KEY = 'network_status';
const WITHDRAWAL_CONFIG_KEY = 'agent_withdrawal_config';

export const REFERRAL_MILESTONE_LADDER = [
  { milestoneCount: 2, bonusAmount: 5 },
  { milestoneCount: 5, bonusAmount: 15 },
  { milestoneCount: 10, bonusAmount: 40 },
  { milestoneCount: 20, bonusAmount: 100 }
];

const DEFAULT_NETWORK_STATUS = {
  status: 'green',
  message: ''
};

const DEFAULT_WITHDRAWAL_CONFIG = {
  minimumAmount: AGENT_MIN_WITHDRAWAL_GHS,
  feeType: 'flat',
  flatFee: 2.5,
  feePercent: 0,
  minFee: 0,
  maxFee: 0,
  note: 'Manual payouts may take a little time after approval.'
};

async function getOrCreateSetting(key, defaultValue, description = '') {
  const setting = await AppSetting.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        key,
        value: defaultValue,
        description
      }
    },
    {
      upsert: true,
      new: true
    }
  );

  return setting;
}

function normalizeNetworkStatus(value = {}) {
  const status = ['green', 'yellow', 'red'].includes(String(value.status || '').toLowerCase())
    ? String(value.status).toLowerCase()
    : DEFAULT_NETWORK_STATUS.status;
  const message = sanitizeText(value.message, 240);
  return { status, message };
}

function normalizeWithdrawalConfig(value = {}) {
  const feeType = String(value.feeType || DEFAULT_WITHDRAWAL_CONFIG.feeType).toLowerCase();
  const minimumAmount = parsePositiveAmount(value.minimumAmount) || DEFAULT_WITHDRAWAL_CONFIG.minimumAmount;
  const flatFee = roundMoney(parsePositiveAmount(value.flatFee) || DEFAULT_WITHDRAWAL_CONFIG.flatFee);
  const feePercent = roundMoney(parsePositiveAmount(value.feePercent));
  const minFee = roundMoney(parsePositiveAmount(value.minFee));
  const maxFee = roundMoney(parsePositiveAmount(value.maxFee));

  return {
    minimumAmount,
    feeType: feeType === 'percent' ? 'percent' : 'flat',
    flatFee,
    feePercent,
    minFee,
    maxFee,
    note: sanitizeText(value.note, 240) || DEFAULT_WITHDRAWAL_CONFIG.note
  };
}

export async function getNetworkStatusSetting() {
  const setting = await getOrCreateSetting(
    NETWORK_STATUS_KEY,
    DEFAULT_NETWORK_STATUS,
    'Customer-facing network banner state'
  );
  return normalizeNetworkStatus(setting.value);
}

export async function setNetworkStatusSetting(value = {}, updatedBy = null) {
  const normalized = normalizeNetworkStatus(value);
  const setting = await AppSetting.findOneAndUpdate(
    { key: NETWORK_STATUS_KEY },
    {
      $set: {
        value: normalized,
        updatedBy: updatedBy || null,
        description: 'Customer-facing network banner state'
      }
    },
    {
      upsert: true,
      new: true
    }
  );

  return normalizeNetworkStatus(setting.value);
}

export async function getWithdrawalConfig() {
  const setting = await getOrCreateSetting(
    WITHDRAWAL_CONFIG_KEY,
    DEFAULT_WITHDRAWAL_CONFIG,
    'Agent withdrawal fee and minimum rules'
  );
  return normalizeWithdrawalConfig(setting.value);
}

export function calculateWithdrawalPreview(amount, configInput = DEFAULT_WITHDRAWAL_CONFIG) {
  const config = normalizeWithdrawalConfig(configInput);
  const requestedAmount = roundMoney(parsePositiveAmount(amount));
  if (requestedAmount <= 0) {
    return {
      minimumAmount: roundMoney(config.minimumAmount),
      feeType: config.feeType,
      flatFee: roundMoney(config.flatFee),
      feePercent: roundMoney(config.feePercent),
      minFee: roundMoney(config.minFee),
      maxFee: roundMoney(config.maxFee),
      requestedAmount: 0,
      withdrawalFee: 0,
      netPayout: 0,
      note: config.note
    };
  }
  let withdrawalFee = 0;

  if (config.feeType === 'percent') {
    withdrawalFee = roundMoney((requestedAmount * config.feePercent) / 100);
    if (config.minFee > 0) {
      withdrawalFee = Math.max(withdrawalFee, config.minFee);
    }
    if (config.maxFee > 0) {
      withdrawalFee = Math.min(withdrawalFee, config.maxFee);
    }
    withdrawalFee = roundMoney(withdrawalFee);
  } else {
    withdrawalFee = roundMoney(config.flatFee);
  }

  return {
    minimumAmount: roundMoney(config.minimumAmount),
    feeType: config.feeType,
    flatFee: roundMoney(config.flatFee),
    feePercent: roundMoney(config.feePercent),
    minFee: roundMoney(config.minFee),
    maxFee: roundMoney(config.maxFee),
    requestedAmount,
    withdrawalFee,
    netPayout: roundMoney(Math.max(requestedAmount - withdrawalFee, 0)),
    note: config.note
  };
}
