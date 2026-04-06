export const calculateCommission = (saleAmount) => {
  const rate = parseFloat(process.env.AGENT_COMMISSION_RATE) || 0.15;
  return saleAmount * rate;
};

export const calculateReferralBonus = () => {
  return parseFloat(process.env.REFERRAL_BONUS) || 15;
};