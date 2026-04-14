const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_SAFE_REGEX = /[^a-z0-9]+/g;

export const AGENT_ONBOARDING_FEE_GHS = 75;
export const AGENT_REFERRAL_BONUS_GHS = 25;
export const AGENT_MIN_WITHDRAWAL_GHS = 50;

export const NETWORK_KEYS = ['mtn', 'airteltigo', 'telecel'];
export const TIER_KEYS = ['budget', 'express', 'instant', 'standard'];

const TIER_ALIAS_MAP = {
  beneficiary: 'budget',
  budget: 'budget',
  express: 'express',
  instant: 'instant',
  standard: 'standard'
};

export function roundMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function sanitizeText(value, maxLength = 160) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_REGEX.test(email) ? email : '';
}

export function isValidEmail(value) {
  return Boolean(normalizeEmail(value));
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^233[235]\d{8}$/.test(digits)) return digits;
  if (/^0[235]\d{8}$/.test(digits)) return `233${digits.slice(1)}`;
  return '';
}

export function isValidPhone(value) {
  return Boolean(normalizePhone(value));
}

export function normalizeMoMoNumber(value) {
  return normalizePhone(value);
}

export function normalizeNetworkKey(value) {
  const network = sanitizeText(value, 40).toLowerCase();
  return NETWORK_KEYS.includes(network) ? network : '';
}

export function normalizeTierKey(value) {
  const tier = sanitizeText(value, 40).toLowerCase();
  return TIER_ALIAS_MAP[tier] || '';
}

export function parsePositiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : 0;
}

export function parseVolumeGb(value) {
  const amount = Number.parseFloat(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function slugify(value, fallback = 'agent-store') {
  const cleaned = sanitizeText(value, 80)
    .toLowerCase()
    .replace(SLUG_SAFE_REGEX, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

export function buildStoreLink(frontendBaseUrl, storeSlug) {
  const base = String(frontendBaseUrl || '').trim().replace(/\/$/, '');
  return `${base}/agent-store.html?store=${encodeURIComponent(String(storeSlug || '').trim())}`;
}

export function getFrontendBaseUrl() {
  return String(process.env.FRONTEND_URL || 'https://mysterybundlehub.com')
    .trim()
    .replace(/\/$/, '');
}

function applyPsychologicalEnding(value, ending) {
  const whole = Math.floor(Number(value) || 0);
  const nextWhole = whole + 1;
  const base = roundMoney(whole + ending);
  return base >= value ? base : roundMoney(nextWhole + ending);
}

export function toPsychologicalPrice(minimumPrice, preferredEnding = 0.99) {
  const amount = roundMoney(minimumPrice);
  if (amount <= 0) return 0;

  const endings = preferredEnding === 0.49
    ? [0.49, 0.79, 0.99]
    : preferredEnding === 0.79
      ? [0.79, 0.99]
      : [0.99];

  for (const ending of endings) {
    const candidate = applyPsychologicalEnding(amount, ending);
    if (candidate >= amount) return candidate;
  }

  return roundMoney(Math.ceil(amount));
}

export function safeNumber(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

export function toIdString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.toString ? value.toString() : String(value);
}
