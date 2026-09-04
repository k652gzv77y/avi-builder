/**
 * Shared configuration constants
 */

/** Base URL for the templates / icons service */
export const TEMPLATE_API_URL = process.env.TEMPLATE_API_URL || '';

/** @deprecated Use TEMPLATE_API_URL */
export const YCODE_EXTERNAL_API_URL = TEMPLATE_API_URL;
