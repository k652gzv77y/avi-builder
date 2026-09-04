const BUILDER_HOST = 'avibuilder.com';
const KOLBO_STAGING = 'https://beta.kolboschool.com';

export function publishedOrigin(canonical?: string | null): string {
  const configured = canonical?.trim().replace(/\/$/, '') || '';
  const origin = configured || KOLBO_STAGING;
  const host = origin.replace(/^https?:\/\//, '').split('/')[0] || '';
  if (host === BUILDER_HOST || host === `www.${BUILDER_HOST}` || host.endsWith(`.${BUILDER_HOST}`)) {
    return KOLBO_STAGING;
  }
  return origin;
}
