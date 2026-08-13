// Kept separate from lib/password.ts so client components can show the rule
// without pulling node:crypto (and the hashing code) into the browser bundle.
export const MIN_PASSWORD_LENGTH = 10;

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) return "Password is too long.";
  return null;
}
