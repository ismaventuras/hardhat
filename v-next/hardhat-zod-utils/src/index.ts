import type { ZodTypeDef, ZodType } from "zod";

import { z } from "zod";

/**
 * We use `unknown` here to avoid a circular dependency between the Hardhat and
 * the Zod utils packages.
 */
export type HardhatUserConfigToValidate = unknown;

/**
 * For the same reason, we duplicate the type here.
 */
export interface HardhatUserConfigValidationError {
  path: Array<string | number>;
  message: string;
}

/**
 * A Zod untagged union type that returns a custom error message if the value
 * is missing or invalid.
 */
export const unionType = (
  types: Parameters<typeof z.union>[0],
  errorMessage: string,
) =>
  // eslint-disable-next-line no-restricted-syntax -- This is the only place we allow z.union
  z.union(types, {
    errorMap: () => ({
      message: errorMessage,
    }),
  });

/**
 * A Zod type to validate Hardhat's ConfigurationVariable objects.
 */
export const configurationVariableType = z.object({
  _type: z.literal("ConfigurationVariable"),
  name: z.string(),
});

/**
 * A Zod type to validate Hardhat's SensitiveString values.
 */
export const sensitiveStringType = unionType(
  [z.string(), configurationVariableType],
  "Expected a string or a Configuration Variable",
);

/**
 * A Zod type to validate Hardhat's SensitiveString values that expect a URL.
 */
export const sensitiveUrlType = unionType(
  [z.string().url(), configurationVariableType],
  "Expected a URL or a Configuration Variable",
);

/**
 * A function to validate the user's configuration object against a Zod type.
 *
 * Note: The zod type MUST represent the HardhatUserConfig type, or a subset of
 * it. You shouldn't use this function to validate their fields individually.
 * The reason for this is that the paths of the validation errors must start
 * from the root of the config object, so that they are correctly reported to
 * the user.
 */
export async function validateUserConfigZodType<
  Output,
  Def extends ZodTypeDef = ZodTypeDef,
  Input = Output,
>(
  hardhatUserConfig: HardhatUserConfigToValidate,
  configType: ZodType<Output, Def, Input>,
): Promise<HardhatUserConfigValidationError[]> {
  const result = await configType.safeParseAsync(hardhatUserConfig);

  if (result.success) {
    return [];
  } else {
    return result.error.errors.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
  }
}
