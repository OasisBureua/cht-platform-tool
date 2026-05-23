/** True when running a production Node deployment (blocks dev auth bypass). */
export function isProductionEnv(nodeEnv?: string): boolean {
  const env = (nodeEnv ?? process.env.NODE_ENV ?? '').trim().toLowerCase();
  return env === 'production' || env === 'prod';
}
