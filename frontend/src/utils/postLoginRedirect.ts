/**
 * Pick where to send the user after a successful login.
 * Without this, signing out from /app then logging in as admin on /login still had
 * `from` = /app/... from ProtectedRoute, which incorrectly overrode the admin role.
 */
export function getPostLoginPath(
  role: string | undefined,
  fromPathname: string | undefined | null,
): string {
  const from =
    fromPathname &&
    fromPathname !== '/login' &&
    fromPathname !== '/admin/login'
      ? fromPathname
      : undefined;

  const isAdmin = role === 'ADMIN';
  if (isAdmin) {
    if (from && from.startsWith('/admin')) return from;
    return '/admin';
  }

  if (from && !from.startsWith('/admin')) return from;
  return '/app/home';
}
