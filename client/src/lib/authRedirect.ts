export function getLoginRedirectPath(redirectPath?: string): string {
  return redirectPath ? `/login?redirect=${encodeURIComponent(redirectPath)}` : "/login";
}
