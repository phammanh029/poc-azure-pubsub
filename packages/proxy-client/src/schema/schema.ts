/**
 * This define the schemas for the proxy client messages protocol
 */

import { Effect, Schema } from "effect";

export const ChallengeRequestSchema = Schema.Struct({
  op: Schema.Literal("challenge"),
  id: Schema.String,
  data: Schema.Any,
});


export const ChallengeResponseSchema = Schema.Struct({
    op: Schema.Literal('challenge-response'),
    id: Schema.String,
    data: Schema.Any
});
