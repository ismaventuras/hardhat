import type {
  FailedJsonRpcResponse,
  JsonRpcRequest,
  JsonRpcResponse,
  RequestArguments,
} from "../../../types/providers.js";

import { HardhatError } from "@ignored/hardhat-vnext-errors";
import { isObject } from "@ignored/hardhat-vnext-utils/lang";

/**
 * Gets a JSON-RPC 2.0 request object.
 * See https://www.jsonrpc.org/specification#request_object
 */
export function getJsonRpcRequest(
  id: number | string,
  method: string,
  params?: unknown[] | object,
): JsonRpcRequest {
  const requestObject: JsonRpcRequest = {
    jsonrpc: "2.0",
    id,
    method,
  };

  requestObject.params = getRequestParams({ method, params });

  if (id !== undefined) {
    requestObject.id = id;
  }

  return requestObject;
}

export function parseJsonRpcResponse(
  text: string,
): JsonRpcResponse | JsonRpcResponse[] {
  try {
    const json: unknown = JSON.parse(text);

    if (Array.isArray(json)) {
      if (json.every(isJsonRpcResponse)) {
        return json;
      }
    } else if (isJsonRpcResponse(json)) {
      return json;
    }

    /* eslint-disable-next-line no-restricted-syntax -- allow throwing a
    generic error here as it will be handled in the catch block */
    throw new Error();
  } catch {
    throw new HardhatError(HardhatError.ERRORS.NETWORK.INVALID_JSON_RESPONSE, {
      response: text,
    });
  }
}

export function isJsonRpcResponse(
  payload: unknown,
): payload is JsonRpcResponse {
  if (!isObject(payload)) {
    return false;
  }

  if (payload.jsonrpc !== "2.0") {
    return false;
  }

  if (
    typeof payload.id !== "number" &&
    typeof payload.id !== "string" &&
    payload.id !== null
  ) {
    return false;
  }

  if (payload.result === undefined && payload.error === undefined) {
    return false;
  }

  if (payload.error !== undefined) {
    if (!isObject(payload.error)) {
      return false;
    }

    if (typeof payload.error.code !== "number") {
      return false;
    }

    if (typeof payload.error.message !== "string") {
      return false;
    }
  }

  return true;
}

export function isFailedJsonRpcResponse(
  payload: JsonRpcResponse,
): payload is FailedJsonRpcResponse {
  return "error" in payload && payload.error !== undefined;
}

export function getRequestParams(requestArguments: RequestArguments): any[] {
  if (requestArguments.params === undefined) {
    return [];
  }

  if (Array.isArray(requestArguments.params)) {
    return requestArguments.params;
  }

  throw new HardhatError(HardhatError.ERRORS.NETWORK.INVALID_REQUEST_PARAMS);
}
