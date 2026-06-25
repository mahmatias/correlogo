export const sanitizeText = (value: string, maxLength = 200): string =>
  value.trim().replace(/<[^>]*>/g, '').slice(0, maxLength);

export const sanitizeEmail = (value: string): string =>
  value.trim().toLowerCase();
