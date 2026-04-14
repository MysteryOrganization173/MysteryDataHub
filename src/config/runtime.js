function getMissingEnv(keys = []) {
  return keys.filter((key) => !String(process.env[key] || '').trim());
}

export function isProductionLike() {
  return String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
}

export function validateRuntimeConfig() {
  const missingCore = getMissingEnv(['JWT_SECRET']);
  const missingLaunch = getMissingEnv([
    'MONGODB_URI',
    'FRONTEND_URL',
    'CORS_ORIGIN',
    'PAYSTACK_SECRET_KEY',
    'SUCCESSBIZHUB_API_KEY',
    'SUCCESSBIZHUB_BASE_URL'
  ]);

  if (missingCore.length) {
    const error = new Error(`Missing required environment variables: ${missingCore.join(', ')}`);
    error.status = 500;
    throw error;
  }

  if (missingLaunch.length) {
    const message = `Missing launch-critical environment variables: ${missingLaunch.join(', ')}`;
    if (isProductionLike()) {
      const error = new Error(message);
      error.status = 500;
      throw error;
    }
    console.warn(`[startup] ${message}`);
  }
}
