import { ParseResult, Schema } from "effect";

export const lowercaseUUID = Schema.transformOrFail(
	Schema.UUID,
	Schema.UUID.pipe(Schema.brand("lowercaseUUID")),
	{
		decode: (uuid) => ParseResult.succeed(uuid.toLowerCase()),
		encode: (str) => ParseResult.succeed(str),
	},
);
export type lowercaseUUID = Schema.Schema.Type<typeof lowercaseUUID>;
