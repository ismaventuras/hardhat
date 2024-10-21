import type {
  HttpNetworkConfig,
  NetworkConfig,
} from "@ignored/hardhat-vnext/types/config";

export function isHttpNetworkConfig(
  netConfig: Partial<NetworkConfig>,
): netConfig is HttpNetworkConfig {
  return netConfig.type === "http";
}
