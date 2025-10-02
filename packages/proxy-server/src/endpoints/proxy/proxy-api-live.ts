import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer } from "effect";
import { Api } from "../../api";
import { ConnectionService } from "../../services/connection-service";
import { ProxyNoConnectionError } from "./proxy-api";
import { WsService } from "../../services/WsService";
import { generateUUID, RequestMessage } from "../../data/protocol";

export const ProxyLive = HttpApiBuilder.group(Api, "proxy", (handlers) =>
  Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const wsService = yield* WsService;
    return handlers.handle("get", ({ headers }) =>
      Effect.gen(function* () {
        // yield* Effect.log('Received proxy request', req);
        const tenantId = headers["x-tenant-id"];
        // retrieve the connection from redis
        const connectionId = yield* connectionService.getConnection(tenantId);
        if (!connectionId)
          throw new ProxyNoConnectionError({
            message: `No connection found for tenant: ${tenantId}`,
          });

        yield* Effect.log(
          `Found connection ${connectionId} for tenant ${tenantId}`
        );
        const requestData: RequestMessage = {
          id: generateUUID(),
          op: "request",
          data: {
            headers: {
              "x-tenant-id": tenantId,
              "x-connection-id": connectionId,
            },
            path: "/info",
            method: "GET",
            type: "call",
          },
        };

        // send the message to the connection
        const clientResponse = yield* wsService.sendToClient(
          connectionId,
          requestData
        );
        yield* Effect.log("Received response from client", clientResponse);

        return {
          headers: { key: "value" },
          body: "Proxy response body",
          status: 200,
        };
      })
    );
  })
).pipe(Layer.provide([ConnectionService.Default]));
