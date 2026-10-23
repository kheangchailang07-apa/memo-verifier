import dotenv from 'dotenv';

/**
 * Loads the shared .env (production values) first, then the per-instance file
 * named by ENV_FILE on top of it (npm run dev1 -> .env1, npm run dev2 -> .env2).
 * The instance file wins, so PORT / FRONTEND_URL / DB_* can differ per app.
 */
export const loadEnv = (): void => {
  dotenv.config();

  const instanceFile = process.env.ENV_FILE;
  if (instanceFile) {
    dotenv.config({ path: instanceFile, override: true });
  }
};
