// Mapping from our internal bundle codes to Success Biz Hub offerSlug and volume
export const getOfferSlugAndVolume = (bundleCode) => {
  const map = {
    // MTN Express Bundle
    'MTN_1GB_90D':   { offerSlug: 'mtn_express_bundle', volume: 1 },
    'MTN_2GB_90D':   { offerSlug: 'mtn_express_bundle', volume: 2 },
    'MTN_3GB_90D':   { offerSlug: 'mtn_express_bundle', volume: 3 },
    'MTN_4GB_90D':   { offerSlug: 'mtn_express_bundle', volume: 4 },
    'MTN_5GB_90D':   { offerSlug: 'mtn_express_bundle', volume: 5 },
    'MTN_6GB_90D':   { offerSlug: 'mtn_express_bundle', volume: 6 },
    'MTN_8GB_90D':   { offerSlug: 'mtn_express_bundle', volume: 8 },
    'MTN_10GB_90D':  { offerSlug: 'mtn_express_bundle', volume: 10 },
    'MTN_15GB_90D':  { offerSlug: 'mtn_express_bundle', volume: 15 },
    'MTN_20GB_90D':  { offerSlug: 'mtn_express_bundle', volume: 20 },
    'MTN_25GB_90D':  { offerSlug: 'mtn_express_bundle', volume: 25 },
    'MTN_30GB_90D':  { offerSlug: 'mtn_express_bundle', volume: 30 },
    'MTN_40GB_90D':  { offerSlug: 'mtn_express_bundle', volume: 40 },

    // AirtelTigo iShare (60 days)
    'AT_1GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 1 },
    'AT_2GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 2 },
    'AT_3GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 3 },
    'AT_4GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 4 },
    'AT_5GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 5 },
    'AT_6GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 6 },
    'AT_7GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 7 },
    'AT_8GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 8 },
    'AT_9GB_60D':    { offerSlug: 'ishare_data_bundle', volume: 9 },
    'AT_10GB_60D':   { offerSlug: 'ishare_data_bundle', volume: 10 },
    'AT_12GB_60D':   { offerSlug: 'ishare_data_bundle', volume: 12 },
    'AT_15GB_60D':   { offerSlug: 'ishare_data_bundle', volume: 15 },
    'AT_20GB_60D':   { offerSlug: 'ishare_data_bundle', volume: 20 },
    'AT_25GB_60D':   { offerSlug: 'ishare_data_bundle', volume: 25 },
    'AT_30GB_60D':   { offerSlug: 'ishare_data_bundle', volume: 30 },

    // AirtelTigo BigTime (non‑expiry)
    'AT_40GB_NOEXP': { offerSlug: 'bigtime_data_bundle', volume: 40 },
    'AT_50GB_NOEXP': { offerSlug: 'bigtime_data_bundle', volume: 50 },
    'AT_60GB_NOEXP': { offerSlug: 'bigtime_data_bundle', volume: 60 },
    'AT_70GB_NOEXP': { offerSlug: 'bigtime_data_bundle', volume: 70 },
    'AT_80GB_NOEXP': { offerSlug: 'bigtime_data_bundle', volume: 80 },
    'AT_90GB_NOEXP': { offerSlug: 'bigtime_data_bundle', volume: 90 },
    'AT_100GB_NOEXP':{ offerSlug: 'bigtime_data_bundle', volume: 100 },

    // Telecel Expiry Bundle (60 days)
    'TEL_5GB_60D':   { offerSlug: 'telecel_expiry_bundle', volume: 5 },
    'TEL_10GB_60D':  { offerSlug: 'telecel_expiry_bundle', volume: 10 },
    'TEL_15GB_60D':  { offerSlug: 'telecel_expiry_bundle', volume: 15 },
    'TEL_20GB_60D':  { offerSlug: 'telecel_expiry_bundle', volume: 20 },
    'TEL_25GB_60D':  { offerSlug: 'telecel_expiry_bundle', volume: 25 },
    'TEL_30GB_60D':  { offerSlug: 'telecel_expiry_bundle', volume: 30 },
    'TEL_40GB_60D':  { offerSlug: 'telecel_expiry_bundle', volume: 40 },
    'TEL_50GB_60D':  { offerSlug: 'telecel_expiry_bundle', volume: 50 },
    'TEL_100GB_60D': { offerSlug: 'telecel_expiry_bundle', volume: 100 }
  };

  return map[bundleCode] || { offerSlug: null, volume: null };
};