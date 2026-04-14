export const DEFAULT_ADMIN_EMAIL = 'aryeeteyemmanuel852@gmail.com';

export const DEFAULT_ADMIN_FULL_NAME = String(
  process.env.ADMIN_FULL_NAME || 'Platform Administrator'
)
  .trim();

export const DEFAULT_ADMIN_PHONE = String(
  process.env.ADMIN_PHONE || '233000000000'
)
  .trim();

// Default login password is stored as a bcrypt hash so the repo never keeps
// the raw secret in frontend code or plain backend config.
export const DEFAULT_ADMIN_PASSWORD_HASH = '$2a$10$WwIIwxy7PamLV5mChccfy.hCodxImXvlhkYIMP52ue.M/nnnnSqxe';
