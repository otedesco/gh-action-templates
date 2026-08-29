export const missingTokenMessage =
  "Missing NPM_TOKEN: this repository installs private @otedesco packages from GitHub Packages. Configure the NPM_TOKEN repository secret with packages:read access.";

export function validateRegistryToken(token) {
  if (typeof token !== "string" || token.trim() === "") {
    throw new Error(missingTokenMessage);
  }

  return true;
}

export function runRegistryAuth(token, { onError = console.error, onSuccess = console.log } = {}) {
  try {
    validateRegistryToken(token);
    onSuccess("Private registry credentials are configured.");
    return 0;
  } catch (error) {
    onError(`::error::${error.message}`);
    return 1;
  }
}
