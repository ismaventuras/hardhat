import type {
  ConfigurationVariable,
  EdrNetworkConfig,
  GasConfig,
  GasUserConfig,
  HardhatConfig,
  HardhatUserConfig,
  HttpNetworkConfig,
  NetworkConfig,
  NetworkUserConfig,
  ResolvedConfigurationVariable,
} from "../../../../types/config.js";
import type { ConfigHooks } from "../../../../types/hooks.js";

import { HardhatError } from "@ignored/hardhat-vnext-errors";

import { validateUserConfig } from "../type-validation.js";

export default async (): Promise<Partial<ConfigHooks>> => ({
  extendUserConfig,
  validateUserConfig,
  resolveUserConfig,
});

export async function extendUserConfig(
  config: HardhatUserConfig,
  next: (nextConfig: HardhatUserConfig) => Promise<HardhatUserConfig>,
): Promise<HardhatUserConfig> {
  const extendedConfig = await next(config);

  const networks: Record<string, NetworkUserConfig> =
    extendedConfig.networks ?? {};

  return {
    ...extendedConfig,
    networks: {
      ...networks,
      localhost: {
        url: "http://localhost:8545",
        ...networks.localhost,
        type: "http",
      },
      hardhat: {
        type: "edr",
        chainId: 31337,
        chainType: "l1",
        gas: "auto",
        gasMultiplier: 1,
        gasPrice: "auto",
      },
    },
  };
}

export async function resolveUserConfig(
  userConfig: HardhatUserConfig,
  resolveConfigurationVariable: (
    variableOrString: ConfigurationVariable | string,
  ) => ResolvedConfigurationVariable,
  next: (
    nextUserConfig: HardhatUserConfig,
    nextResolveConfigurationVariable: (
      variableOrString: ConfigurationVariable | string,
    ) => ResolvedConfigurationVariable,
  ) => Promise<HardhatConfig>,
): Promise<HardhatConfig> {
  const resolvedConfig = await next(userConfig, resolveConfigurationVariable);

  const networks: Record<string, NetworkUserConfig> = userConfig.networks ?? {};

  const resolvedNetworks: Record<string, NetworkConfig> = {};

  for (const [networkName, networkConfig] of Object.entries(networks)) {
    if (networkConfig.type !== "http" && networkConfig.type !== "edr") {
      throw new HardhatError(HardhatError.ERRORS.NETWORK.INVALID_NETWORK_TYPE, {
        networkName,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- we want to show the type
        networkType: (networkConfig as any).type,
      });
    }

    if (networkConfig.type === "http") {
      const resolvedNetworkConfig: HttpNetworkConfig = {
        type: "http",
        chainId: networkConfig.chainId,
        chainType: networkConfig.chainType,
        from: networkConfig.from,
        gas: resolveGasConfig(networkConfig.gas),
        gasMultiplier: networkConfig.gasMultiplier ?? 1,
        gasPrice: resolveGasConfig(networkConfig.gasPrice),
        url: networkConfig.url,
        timeout: networkConfig.timeout ?? 20_000,
        httpHeaders: networkConfig.httpHeaders ?? {},
      };

      resolvedNetworks[networkName] = resolvedNetworkConfig;
    }

    if (networkConfig.type === "edr") {
      const resolvedNetworkConfig: EdrNetworkConfig = {
        type: "edr",
        chainId: networkConfig.chainId,
        chainType: networkConfig.chainType ?? "l1",
        from: resolveFrom(networkConfig.from),
        gas: resolveGasConfig(networkConfig.gas),
        gasMultiplier: networkConfig.gasMultiplier ?? 1,
        gasPrice: resolveGasConfig(networkConfig.gasPrice),

        hardfork: networkConfig.hardfork ?? "cancun",
        networkId: networkConfig.networkId ?? networkConfig.chainId,
        blockGasLimit: networkConfig.blockGasLimit ?? 12_500_000,
        minGasPrice: BigInt(networkConfig.minGasPrice ?? 0),
        automine: networkConfig.automine ?? true,
        intervalMining: networkConfig.intervalMining ?? 0,
        mempoolOrder: networkConfig.mempoolOrder ?? "fifo",
        chains: networkConfig.chains ?? new Map(),
        genesisAccounts: networkConfig.genesisAccounts ?? [],
        allowUnlimitedContractSize:
          networkConfig.allowUnlimitedContractSize ?? false,
        throwOnTransactionFailures:
          networkConfig.throwOnTransactionFailures ?? true,
        throwOnCallFailures: networkConfig.throwOnCallFailures ?? true,
        allowBlocksWithSameTimestamp:
          networkConfig.allowBlocksWithSameTimestamp ?? false,
        enableTransientStorage: networkConfig.enableTransientStorage ?? false,
        enableRip7212: networkConfig.enableRip7212 ?? false,
      };

      resolvedNetworks[networkName] = resolvedNetworkConfig;
    }
  }

  return {
    ...resolvedConfig,
    defaultChainType: resolvedConfig.defaultChainType ?? "unknown",
    defaultNetwork: resolvedConfig.defaultNetwork ?? "hardhat",
    networks: resolvedNetworks,
  };
}

function resolveGasConfig(value: GasUserConfig = "auto"): GasConfig {
  return value === "auto" ? value : BigInt(value);
}

function resolveFrom(from: string | undefined): string {
  if (from === undefined) {
    // TODO: I assume the default should be pulled from the accounts?
    return "0x12345 - should come from account";
  }

  return from;
}
