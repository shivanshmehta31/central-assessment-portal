import * as crypto from 'crypto';

const AMBIGUOUS = /[0O1lI]/g;

export function generateTempPassword(length = 10): string {
  const raw = crypto.randomBytes(length).toString('base64').replace(/[+/=]/g, '');
  const cleaned = raw.replace(AMBIGUOUS, 'x').slice(0, length);
  return `${cleaned}#${crypto.randomInt(10, 99)}`;
}
