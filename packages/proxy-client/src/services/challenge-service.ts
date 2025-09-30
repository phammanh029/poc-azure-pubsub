import { Effect } from 'effect';
import { ChallengeRequestSchema } from '../schema/schema';

export class ChallengeService extends Effect.Service<ChallengeService>()(
  'ChallengeService',
  {
    effect: Effect.gen(function* () {
      return {
        respondToChallenge: (data: ChallengeRequestSchema) =>
          Effect.gen(function* () {
            // Implement the logic to respond to the challenge
            return {
              id: data.id,
              op: 'challenge',
              data: {
                signedMessage: 'signed-message-placeholder',
              },
            };
          }),
      };
    }),
  }
) {}
