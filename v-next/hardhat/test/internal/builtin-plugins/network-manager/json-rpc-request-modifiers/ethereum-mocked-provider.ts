import type {
  EIP1193Provider,
  JsonRpcRequest,
  JsonRpcResponse,
  RequestArguments,
} from "../../../../../src/types/providers.js";

import EventEmitter from "node:events";

// This mock is used in the unit tests to simulate the return value of the "request" method
export class EthereumMockedProvider
  extends EventEmitter
  implements EIP1193Provider
{
  // Record<methodName, value>
  readonly #returnValues: Record<string, any> = {};

  readonly #numberOfCalls: { [method: string]: number } = {};

  // If a lambda is passed as value, it's return value is used.
  public setReturnValue(method: string, value: any): void {
    this.#returnValues[method] = value;
  }

  public getTotalNumberOfCalls(): number {
    return Object.values(this.#numberOfCalls).reduce((p, c) => p + c, 0);
  }

  public async request({
    method,
    params = [],
  }: RequestArguments): Promise<any> {
    // stringify the params to make sure they are serializable
    JSON.stringify(params);

    if (this.#numberOfCalls[method] === undefined) {
      this.#numberOfCalls[method] = 1;
    } else {
      this.#numberOfCalls[method] += 1;
    }

    let ret = this.#returnValues[method];

    if (ret instanceof Function) {
      ret = ret();
    }

    return ret;
  }

  public send(_method: string, _params?: unknown[]): Promise<unknown> {
    return Promise.resolve(null);
  }

  public sendAsync(
    _jsonRpcRequest: JsonRpcRequest,
    _callback: (error: any, jsonRpcResponse: JsonRpcResponse) => void,
  ): void {}

  public async close(): Promise<void> {}
}
