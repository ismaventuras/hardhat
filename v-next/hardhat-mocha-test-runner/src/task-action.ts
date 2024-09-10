import type { HardhatConfig } from "@ignored/hardhat-vnext/types/config";
import type { NewTaskActionFunction } from "@ignored/hardhat-vnext/types/tasks";
import type { MochaOptions } from "mocha";

import { resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HardhatError } from "@ignored/hardhat-vnext-errors";
import { getAllFilesMatching } from "@ignored/hardhat-vnext-utils/fs";

interface TestActionArguments {
  testFiles: string[];
  bail: boolean;
  grep: string;
}

function isTypescriptFile(path: string): boolean {
  return /\.(ts|cts|mts)$/i.test(path);
}

function isJavascriptFile(path: string): boolean {
  return /\.(js|cjs|mjs)$/i.test(path);
}

async function getTestFiles(
  testFiles: string[],
  config: HardhatConfig,
): Promise<string[]> {
  if (testFiles.length !== 0) {
    const testFilesAbsolutePaths = testFiles.map((x) =>
      pathResolve(process.cwd(), x),
    );

    return testFilesAbsolutePaths;
  }

  return getAllFilesMatching(
    config.paths.tests.mocha,
    (f) => isJavascriptFile(f) || isTypescriptFile(f),
  );
}

let testsAlreadyRun = false;
const testWithHardhat: NewTaskActionFunction<TestActionArguments> = async (
  { testFiles, bail, grep },
  hre,
) => {
  const files = await getTestFiles(testFiles, hre.config);

  const tsx = fileURLToPath(import.meta.resolve("tsx/esm"));
  process.env.NODE_OPTIONS = `--import ${tsx}`;

  const { default: Mocha } = await import("mocha");

  const mochaConfig: MochaOptions = { ...hre.config.mocha };

  if (grep !== "") {
    mochaConfig.grep = grep;
  }

  if (bail) {
    mochaConfig.bail = true;
  }

  const mocha = new Mocha(mochaConfig);

  files.forEach((file) => mocha.addFile(file));

  // Because of the way the ESM cache works, loadFilesAsync doesn't work
  // correctly if used twice within the same process, so we throw an error
  // in that case
  if (testsAlreadyRun) {
    throw new HardhatError(
      HardhatError.ERRORS.BUILTIN_TASKS.TEST_TASK_ESM_TESTS_RUN_TWICE,
    );
  }
  testsAlreadyRun = true;

  // This instructs Mocha to use the more verbose file loading infrastructure
  // which supports both ESM and CJS
  await mocha.loadFilesAsync();

  const testFailures = await new Promise<number>((resolve) => {
    mocha.run(resolve);
  });

  if (testFailures > 0) {
    process.exitCode = 1;
  }

  return testFailures;
};

export default testWithHardhat;
