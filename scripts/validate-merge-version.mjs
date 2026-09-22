import { assertVersionIncreased } from "./version-utils.mjs";

const [previousVersion, currentVersion] = process.argv.slice(2);

try {
  assertVersionIncreased(previousVersion, currentVersion);
  console.log(`Application version increased: ${previousVersion} -> ${currentVersion}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
