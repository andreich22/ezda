import fs from "node:fs/promises";
import path from "node:path";
import { validateVersion } from "./version-utils.mjs";

const root = process.cwd();

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
}

try {
  const packageJson = await readJson("package.json");
  const version = validateVersion(packageJson.version, "package.json version");

  try {
    const packageLock = await readJson("package-lock.json");
    const lockVersion = packageLock.version;
    const rootPackageVersion = packageLock.packages?.[""]?.version;

    if (lockVersion !== version) {
      throw new Error(
        `package-lock.json version does not match package.json (${lockVersion} != ${version})`,
      );
    }

    if (rootPackageVersion !== version) {
      throw new Error(
        `package-lock.json root package version does not match package.json (${rootPackageVersion} != ${version})`,
      );
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      // package-lock.json is optional for non-npm projects.
    } else {
      throw error;
    }
  }

  console.log(`Application version: ${version}`);
} catch (error) {
  console.error(`Invalid application version: ${error.message}`);
  process.exitCode = 1;
}
