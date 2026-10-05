export function getUsernameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [username] = email.split("@");
  return username || null;
}
