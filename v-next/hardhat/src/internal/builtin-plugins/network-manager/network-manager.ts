import type { NetworkConfig } from "../../../types/config.js";
import type { HookManager } from "../../../types/hooks.js";
import type {
  ChainType,
  DefaultChainType,
  NetworkConnection,
} from "../../../types/network.js";
import type { EthereumProvider } from "../../../types/providers.js";

import {
  assertHardhatInvariant,
  HardhatError,
} from "@ignored/hardhat-vnext-errors";

import { EdrProvider } from "./edr/edr-provider.js";
import { HttpProvider } from "./http-provider.js";
import { NetworkConnectionImplementation } from "./network-connection.js";
import { isNetworkConfig, validateNetworkConfig } from "./type-validation.js";

export class NetworkManagerImplementation {
  readonly #defaultNetwork: string;
  readonly #defaultChainType: DefaultChainType;
  readonly #networkConfigs: Record<string, NetworkConfig>;
  readonly #hookManager: HookManager;

  #nextConnectionId = 0;

  constructor(
    defaultNetwork: string,
    defaultChainType: DefaultChainType,
    networkConfigs: Record<string, NetworkConfig>,
    hookManager: HookManager,
  ) {
    this.#defaultNetwork = defaultNetwork;
    this.#defaultChainType = defaultChainType;
    this.#networkConfigs = networkConfigs;
    this.#hookManager = hookManager;
  }

  public async connect<
    ChainTypeT extends ChainType | string = DefaultChainType,
  >(
    networkName?: string,
    chainType?: ChainTypeT,
    networkConfigOverride?: Partial<NetworkConfig>,
  ): Promise<NetworkConnection<ChainTypeT>> {
    const networkConnection = await this.#hookManager.runHandlerChain(
      "network",
      "newConnection",
      [],
      async (_context) =>
        this.#initializeNetworkConnection(
          networkName,
          chainType,
          networkConfigOverride,
        ),
    );

    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    -- Cast to NetworkConnection<ChainTypeT> because we know it's valid */
    return networkConnection as NetworkConnection<ChainTypeT>;
  }

  async #initializeNetworkConnection<ChainTypeT extends ChainType | string>(
    networkName?: string,
    chainType?: ChainTypeT,
    networkConfigOverride?: Partial<NetworkConfig>,
  ): Promise<NetworkConnection<ChainTypeT>> {
    const resolvedNetworkName = networkName ?? this.#defaultNetwork;
    if (this.#networkConfigs[resolvedNetworkName] === undefined) {
      throw new HardhatError(HardhatError.ERRORS.NETWORK.NETWORK_NOT_FOUND, {
        networkName: resolvedNetworkName,
      });
    }

    if (
      networkConfigOverride !== undefined &&
      "type" in networkConfigOverride &&
      networkConfigOverride.type !==
        this.#networkConfigs[resolvedNetworkName].type
    ) {
      throw new HardhatError(
        HardhatError.ERRORS.NETWORK.INVALID_CONFIG_OVERRIDE,
        {
          errors: `\t* The type of the network cannot be changed.`,
        },
      );
    }

    const resolvedNetworkConfig = {
      ...this.#networkConfigs[resolvedNetworkName],
      ...networkConfigOverride,
    };

    if (!isNetworkConfig(resolvedNetworkConfig)) {
      const validationErrors = validateNetworkConfig(resolvedNetworkConfig);

      throw new HardhatError(
        HardhatError.ERRORS.NETWORK.INVALID_CONFIG_OVERRIDE,
        {
          errors: `\t${validationErrors
            .map(
              (error) => `* Error in ${error.path.join(".")}: ${error.message}`,
            )
            .join("\n\t")}`,
        },
      );
    }

    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    -- Cast to ChainTypeT because we know it's valid */
    const resolvedChainType = (chainType ??
      resolvedNetworkConfig.chainType ??
      this.#defaultChainType) as ChainTypeT;

    /**
     * If resolvedNetworkConfig.chainType is defined, it must match the
     * provided chainType.
     * We use resolvedChainType as it will be either chainType or
     * resolvedNetworkConfig.chainType in this context.
     */
    if (
      resolvedNetworkConfig.chainType !== undefined &&
      resolvedChainType !== resolvedNetworkConfig.chainType
    ) {
      throw new HardhatError(HardhatError.ERRORS.NETWORK.INVALID_CHAIN_TYPE, {
        networkName: resolvedNetworkName,
        chainType: resolvedChainType,
        networkChainType: resolvedNetworkConfig.chainType,
      });
    }

    // We only need to capture the hook manager in the closures below
    const hookManager = this.#hookManager;

    const createProvider = async (
      networkConnection: NetworkConnectionImplementation<ChainTypeT>,
    ): Promise<EthereumProvider> => {
      assertHardhatInvariant(
        resolvedNetworkConfig.type === "edr" ||
          resolvedNetworkConfig.type === "http",
        `Invalid network type ${resolvedNetworkConfig.type}`,
      );

      if (resolvedNetworkConfig.type === "edr") {
        return EdrProvider.create(resolvedNetworkConfig, { enabled: false });
      }

      return HttpProvider.create({
        url: resolvedNetworkConfig.url,
        networkName: resolvedNetworkName,
        extraHeaders: resolvedNetworkConfig.httpHeaders,
        timeout: resolvedNetworkConfig.timeout,
        jsonRpcRequestWrapper: (request, defaultBehavior) =>
          hookManager.runHandlerChain(
            "network",
            "onRequest",
            [networkConnection, request],
            async (_context, _connection, req) => defaultBehavior(req),
          ),
      });
    };

    return NetworkConnectionImplementation.create(
      this.#nextConnectionId++,
      resolvedNetworkName,
      resolvedChainType,
      resolvedNetworkConfig,
      async (connection: NetworkConnectionImplementation<ChainTypeT>) => {
        await hookManager.runHandlerChain(
          "network",
          "closeConnection",
          [connection],
          async (_context, conn) => {
            await conn.provider.close();
          },
        );
      },
      createProvider,
    );
  }
}
