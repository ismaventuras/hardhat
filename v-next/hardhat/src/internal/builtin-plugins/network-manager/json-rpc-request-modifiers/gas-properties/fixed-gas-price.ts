import type { RequestArguments } from "../../../../../types/providers.js";
import type { PrefixedHexString } from "@ignored/hardhat-vnext-utils/hex";

import { getRequestParams } from "../../json-rpc.js";

/**
 * This class ensures that a fixed gas price is applied to transaction requests.
 * For `eth_sendTransaction` requests, it sets the gasPrice field with the value provided via the class constructor, if it hasn't been specified already.
 */
export class FixedGasPrice {
  readonly #gasPrice: PrefixedHexString;

  constructor(gasPrice: PrefixedHexString) {
    this.#gasPrice = gasPrice;
  }

  public modifyRequest(args: RequestArguments): void {
    if (args.method === "eth_sendTransaction") {
      const params = getRequestParams(args);

      // TODO: from V2 - Should we validate this type?
      const tx = params[0];

      // Temporary change to ignore EIP-1559
      if (
        tx !== undefined &&
        tx.gasPrice === undefined &&
        tx.maxFeePerGas === undefined &&
        tx.maxPriorityFeePerGas === undefined
      ) {
        tx.gasPrice = this.#gasPrice;
      }
    }
  }
}
