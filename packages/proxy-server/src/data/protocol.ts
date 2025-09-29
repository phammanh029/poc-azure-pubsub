import { Config, Schema } from "effect";
import { v7 } from "uuid";

import { InstanceIdentifier } from "./instance";
import { lowercaseUUID } from "../schema/uuid";

// re-export as this was previously declared here
export { jtlProduct } from "./instance";

// We trust the uuid library to generate a valid UUID, so we cast the result to the correct type
export const generateUUID = (): lowercaseUUID =>
	v7().toLowerCase() as unknown as lowercaseUUID;

export const BaseMessage = Schema.Struct({
	/**
	 * The unique identifier for the message.
	 */
	id: lowercaseUUID,
});
export type BaseMessage = Schema.Schema.Type<typeof BaseMessage>;

export const instanceProperties = Schema.Record({
	key: Schema.String,
	value: Schema.Unknown,
});
export type instanceProperties = Schema.Schema.Type<typeof instanceProperties>;

// Downstream from Client to Server
export const InitMessage = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "init"
	 */
	op: Schema.Literal("init"),
	/**
	 * The data payload for initialization.
	 */
	data: Schema.Struct({
		...InstanceIdentifier.fields,
		properties: Schema.optionalWith(instanceProperties, {
			default: () => ({}),
		}),
		// TODO: productVersion & productApiVersion should be moved to properties
		/**
		 * The version of the product connecting to the WebSocket.
		 * If not provided, defaults to "unknown".
		 */
		productVersion: Schema.optionalWith(Schema.String, {
			default: () => "unknown",
		}),
		/**
		 * The API version of the product.
		 * Optional field.
		 */
		productApiVersion: Schema.optional(Schema.String),
	}),
});
export type InitMessage = Schema.Schema.Type<typeof InitMessage>;

// Upstream from Server to Client
export const ChallengeMessage = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "challenge"
	 */
	op: Schema.Literal("challenge"),
	/**
	 * The data payload for the challenge.
	 */
	data: Schema.Struct({
		...InstanceIdentifier.fields,
		properties: instanceProperties,
		/**
		 * The date of the challenge.
		 */
		date: Schema.DateFromString,
		/**
		 * The version of the product connecting to the WebSocket.
		 * If not provided, defaults to "unknown".
		 */
		productVersion: Schema.optionalWith(Schema.String, {
			default: () => "unknown",
		}),
		/**
		 * The API version of the product.
		 * Optional field.
		 */
		productApiVersion: Schema.optional(Schema.String),
	}),
});
export type ChallengeMessage = Schema.Schema.Type<typeof ChallengeMessage>;

// Downstream from Client to Server
export const ChallengeResponseMessage = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "challenge"
	 */
	op: Schema.Literal("challenge"),
	/**
	 * The data payload containing the signed message.
	 */
	data: Schema.Struct({
		/**
		 * The signed message for challenge verification.
		 */
		signedMessage: Schema.String,
	}),
});
export type ChallengeResponseMessage = Schema.Schema.Type<
	typeof ChallengeResponseMessage
>;

// Both upstream and downstream
export const PingMessage = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "ping"
	 */
	op: Schema.Literal("ping"),
	/**
	 * The data payload. New Clients will put the current timestamp (in milliseconds) in the data payload.
	 *
	 * Can later be changed to Schema.DateFromNumber when all clients are updated.
	 */
	data: Schema.String,
});
export type PingMessage = Schema.Schema.Type<typeof PingMessage>;

export const PongMessage = Schema.Struct({
	...BaseMessage.fields,
	data: Schema.String,
	op: Schema.Literal("pong"),
});
export type PongMessage = Schema.Schema.Type<typeof PongMessage>;

// data schema for request-upload-url request
export const RequestUploadUrlRequest = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "request-upload-url"
	 */
	op: Schema.Literal("request-upload-url"),
	/**
	 * The data payload for requesting a signed URL.
	 */
	data: Schema.Struct({
		/**
		 * The content type of the file to be uploaded.
		 */
		contentType: Schema.String,
		/**
		 * The optional file name to generate.
		 */
		name: Schema.optional(Schema.String),
	}),
});
export type RequestUploadUrlRequest = Schema.Schema.Type<
	typeof RequestUploadUrlRequest
>;

// data schema for request-upload-url response
export const GetSignUrlResponse = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "request-upload-url"
	 */
	op: Schema.Literal("request-upload-url"),
	/**
	 * The data payload containing the signed URLs.
	 */
	data: Schema.Struct({
		/**
		 * The URL for uploading the file.
		 */
		uploadUrl: Schema.String,
		/**
		 * The URL for downloading the file.
		 */
		downloadUrl: Schema.String,
		/**
		 * The expiration time of the signed URLs.
		 */
		expiresOn: Schema.String,
	}),
});
export type GetSignUrlResponse = Schema.Schema.Type<typeof GetSignUrlResponse>;

// data schema for key-rotation request
export const KeyRotationRequest = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "key-rotation"
	 */
	op: Schema.Literal("key-rotation"),
	/**
	 * The data payload for key rotation.
	 */
	data: Schema.Struct({
		/**
		 * The subscription key to rotate.
		 */
		subscriptionKey: Schema.String,
	}),
});
export type KeyRotationRequest = Schema.Schema.Type<typeof KeyRotationRequest>;

// data schema for key-rotation response
export const KeyRotationResponse = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "key-rotation"
	 */
	op: Schema.Literal("key-rotation"),
	/**
	 * The data payload can be whatever now, if we want to add more info, we will change this later on.
	 */
	data: Schema.Unknown,
});
export type KeyRotationResponse = Schema.Schema.Type<
	typeof KeyRotationResponse
>;

export enum bodyType {
	"raw" = "raw",
	"base64" = "base64",
	"url" = "url",
}

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

export const RequestMessage = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "request"
	 */
	op: Schema.Literal("request"),
	/**
	 * The data payload for the request.
	 */
	data: Schema.Struct({
		/**
		 * The type of request, set to "call"
		 */
		type: Schema.Literal("call"),
		/**
		 * The path of the request.
		 */
		path: Schema.String,
		/**
		 * The HTTP method of the request.
		 */
		method: Schema.String,
		/**
		 * The headers of the request.
		 */
		headers,
		/**
		 * The optional type of the request body.
		 */
		bodyType: Schema.optional(Schema.Enums(bodyType)),
		/**
		 * The optional body of the request.
		 */
		body: Schema.optional(Schema.String),
	}),
});
export type RequestMessage = Schema.Schema.Type<typeof RequestMessage>;

export const ResponseMessage = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, set to "response"
	 */
	op: Schema.Literal("response"),
	/**
	 * The data payload of the response.
	 */
	data: Schema.Struct({
		/**
		 * The HTTP status code of the response.
		 */
		statusCode: Schema.Int,
		/**
		 * The headers of the response.
		 */
		headers,
	}).pipe(
		Schema.extend(
			Schema.Union(
				Schema.Struct({
					/**
					 * The optional type of the response body.
					 */
					bodyType: Schema.optional(Schema.Never),
					/**
					 * The optional body of the response.
					 */
					body: Schema.optional(Schema.Never),
				}),
				Schema.Struct({
					/**
					 * The optional type of the response body.
					 */
					bodyType: Schema.Literal(bodyType.raw),
					/**
					 * The optional body of the response.
					 */
					body: Schema.String,
				}),
				Schema.Struct({
					/**
					 * The optional type of the response body.
					 */
					bodyType: Schema.Literal(bodyType.base64),
					/**
					 * The optional body of the response.
					 */
					body: Schema.String,
				}),
				Schema.Struct({
					/**
					 * The optional type of the response body.
					 */
					bodyType: Schema.Literal(bodyType.url),
					/**
					 * The optional body of the response.
					 */
					body: Schema.String,
				}),
			),
		),
	),
});
export type ResponseMessage = Schema.Schema.Type<typeof ResponseMessage>;

export const ErrorMessage = Schema.Struct({
	/**
	 * The operation type, set to "error"
	 */
	op: Schema.Literal("error"),
	...BaseMessage.fields,
	/**
	 * The data payload containing error information.
	 */
	data: Schema.Unknown,
});
export type ErrorMessage = Schema.Schema.Type<typeof ErrorMessage>;

/**
 * Represents a union of various downstream message types.
 *
 * This union includes the following message types:
 * - `InitMessage`: Initial message type.
 * - `ChallengeResponseMessage`: Message type for challenge responses.
 * - `PingMessage`: Message type for ping requests.
 * - `PongMessage`: Message type for pong responses.
 * - `ResponseMessage`: General response message type.
 * - `ErrorMessage`: Message type for error responses.
 * - `KeyRotationResponse`: Message type for key rotation responses.
 */
export const DownstreamMessage = Schema.Union(
	InitMessage,
	ChallengeResponseMessage,
	PingMessage,
	PongMessage,
	ResponseMessage,
	RequestUploadUrlRequest,
	ErrorMessage,
	KeyRotationResponse,
);
export type DownstreamMessage = Schema.Schema.Type<typeof DownstreamMessage>;

export const MessageBusRequest = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, which is a literal "request"
	 */
	op: Schema.Literal("request"),
	/**
	 * The data associated with the request
	 */
	data: Schema.Struct({
		...InstanceIdentifier.fields,
		/**
		 * The HTTP method of the request
		 */
		method: Schema.String,
		/**
		 * The path of the request
		 */
		path: Schema.String,
		/**
		 * The headers of the request
		 */
		headers,
		/**
		 * The optional body type of the request, which is an enum value from `bodyType`
		 */
		bodyType: Schema.optionalWith(
			Schema.Union(Schema.Enums(bodyType), Schema.Undefined),
			{
				default: () => undefined,
				nullable: true,
			},
		),
		/**
		 * The optional body of the request
		 */
		body: Schema.optionalWith(
			Schema.Union(Schema.String, Schema.Undefined),
			{
				default: () => undefined,
				nullable: true,
			},
		),
	}),
});
export type MessageBusRequest = Schema.Schema.Type<typeof MessageBusRequest>;

export const MessageBusResponse = Schema.Struct({
	...BaseMessage.fields,
	/**
	 * The operation type, which is always "response" for this schema.
	 */
	op: Schema.Literal("response"),
	/**
	 * The data payload of the response.
	 */
	data: Schema.Struct({
		/**
		 * The HTTP status code of the response.
		 */
		statusCode: Schema.Int,
		/**
		 * The headers of the response.
		 */
		headers,
		/**
		 * The optional type of the response body.
		 */
		bodyType: Schema.optional(Schema.Enums(bodyType)),
		/**
		 * The optional body of the response.
		 */
		body: Schema.optional(Schema.String),
	}),
});
export type MessageBusResponse = Schema.Schema.Type<typeof MessageBusResponse>;
