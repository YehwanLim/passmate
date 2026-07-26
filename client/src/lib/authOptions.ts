export function getGoogleOAuthOptions(redirectTo: string) {
  return {
    redirectTo,
    queryParams: {
      access_type: "offline",
      prompt: "select_account",
    },
  };
}
