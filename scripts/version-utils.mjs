import semver from "semver";

export function validateVersion(version, source = "version") {
  if (typeof version !== "string" || !semver.valid(version)) {
    throw new Error(`Invalid ${source}: ${String(version)}`);
  }
  return version;
}

export function compareVersions(left, right) {
  validateVersion(left, "left version");
  validateVersion(right, "right version");
  return semver.compare(left, right);
}

export function assertVersionIncreased(previousVersion, currentVersion) {
  validateVersion(previousVersion, "previous version");
  validateVersion(currentVersion, "current version");

  const comparison = semver.compare(currentVersion, previousVersion);
  if (comparison <= 0) {
    throw new Error(
      `Application version must increase after merge: ${previousVersion} -> ${currentVersion}`,
    );
  }
}

export function assertTagConsistency({ tagExists, tagCommit, mergeSha, tagName }) {
  if (tagExists && tagCommit !== mergeSha) {
    throw new Error(
      `Git tag ${tagName} already exists at ${tagCommit}, but merge commit is ${mergeSha}`,
    );
  }
}
