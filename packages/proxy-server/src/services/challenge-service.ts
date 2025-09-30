/**
 * This service will handle the challenge-response mechanism for validating clients.
 * When a client connects, it will send a challenge request to the client.
 * The client must respond with the correct challenge response within a timeout period.
 * If the response is valid, the client is considered authenticated and added to the connections storage.
 * If the response is invalid or times out, the client is disconnected from the hub.
 *
 * The challenge-response mechanism ensures that only authorized clients can connect to the server.
 */
import { Effect, Either, Schema } from "effect";
import { GroupMessageReplyFn, WsService } from "./WsService";
import { GroupDataMessage } from "@azure/web-pubsub-client";
import {
  ChallengeMessage,
  ChallengeResponseMessage,
  ErrorMessage,
  generateUUID,
  jtlProduct,
} from "../data/protocol";
import { lowercaseUUID } from "../schema/uuid";
enum ChallengeSteps {
  INIT,
  SENT,
  VERIFYING,
  VERIFIED,
  FAILED,
}

interface ConnectionInfo {
  connectionId: string;
  tenantId: string;
  step: ChallengeSteps;
}

const ChallengeResponseType = Schema.Union(
  ChallengeResponseMessage,
  ErrorMessage
);

type ChallengeSucceed = (
  connectionInfo: ConnectionInfo
) => Effect.Effect<void, never, never>;
type ChallengeFailed = (connectionInfo: ConnectionInfo, reason?: string) => Effect.Effect<void, never, never>;

export class ChallengeService extends Effect.Service<ChallengeService>()(
  "ChallengeService",
  {
    effect: Effect.gen(function* () {
      const wsService = yield* WsService;
      // In-memory store for challenges
      return {
        /**
         * This will start the process of sending challenge to the client and waiting for response
         * @param connection the connection info containing connectionId and tenantId
         * @returns
         */
        start: (
          tenantId: lowercaseUUID,
          connectionId: string,
          onSucceed: ChallengeSucceed,
          onFailed: ChallengeFailed
        ) =>
          Effect.gen(function* () {
            // keep track of the connection
            const connection: ConnectionInfo = {
              connectionId,
              tenantId,
              step: ChallengeSteps.INIT,
            };
            const challengeGroup = `challenge-${tenantId}`;
            // handle challenge response from client
            const challengeResponseHandler = (
              data: GroupDataMessage,
              reply: GroupMessageReplyFn
            ) =>
              Effect.gen(function* () {
                // TODO: validate the userId
                if (data.fromUserId !== connectionId) {
                }
                // parse response
                const challengeResponse = Schema.decodeUnknownEither(
                  ChallengeResponseType
                )(data);
                if (Either.isLeft(challengeResponse)) {
                  connection.step = ChallengeSteps.FAILED;
                  yield* onFailed(connection, "invalid challenge response format");
                  return;
                }

                const message = challengeResponse.right;
                if (message.op === "error") {
                  connection.step = ChallengeSteps.FAILED;
                  yield* onFailed(connection, `challenge response error: ${message.data}`);
                  return;
                }

                // TODO: handle the challenge response
                connection.step = ChallengeSteps.VERIFIED;
                yield* reply({
                  replyTo: challengeGroup,
                  data: {
                    op: "challenge-response",
                    id: message.id,
                    data: {},
                  },
                });
                yield* onSucceed(connection);
              });

            const { send, stop } = yield* wsService.chat(
              challengeGroup,
              challengeResponseHandler,
              connectionId
            );
            const challengeRequest: ChallengeMessage = {
              op: "challenge",
              id: generateUUID(),
              data: {
                date: new Date(),
                instanceId: connectionId,
                product: jtlProduct["erp-api"],
                tenantId: tenantId,
                productVersion: "1.0.0",
                properties: {},
              },
            };
            // send init data
            yield* send({
              replyTo: challengeGroup,
              data: challengeRequest,
            });
          }),
      };
    }),
    dependencies: [WsService.Default],
  }
) {}
