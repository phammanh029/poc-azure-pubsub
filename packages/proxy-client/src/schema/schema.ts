/**
 * This define the schemas for the proxy client messages protocol
 */
import { Effect, Schema } from 'effect';

export const ChallengeRequestSchema = Schema.Struct({
  op: Schema.Literal('challenge'),
  id: Schema.String,
  data: Schema.Any,
});
export type ChallengeRequestSchema = Schema.Schema.Type<
  typeof ChallengeRequestSchema
>;

export const ChallengeResponseSchema = Schema.Struct({
  op: Schema.Literal('challenge-response'),
  id: Schema.String,
  data: Schema.Any,
});
export const headers = Schema.Record({
  /**
   * The key of the header.
   */
  key: Schema.String,
  /**
   * The value of the header.
   */
  value: Schema.String,
});

export const SchemaRequestSchema = Schema.Struct({
  op: Schema.Literal('request'),
  id: Schema.String,
  data: Schema.Struct({
    method: Schema.Union(
      Schema.Literal('GET'),
      Schema.Literal('POST'),
      Schema.Literal('PUT'),
      Schema.Literal('DELETE')
    ),
    path: Schema.String,
    headers,
  }),
});
export type SchemaRequestSchema = Schema.Schema.Type<
  typeof SchemaRequestSchema
>;

export const ProxyRequestDataSchema = Schema.Struct({
  replyTo: Schema.String,
  data: Schema.Union(
    ChallengeRequestSchema,
    ChallengeResponseSchema,
    SchemaRequestSchema
  ),
});
export type ProxyRequestDataType = Schema.Schema.Type<
  typeof ProxyRequestDataSchema
>;
