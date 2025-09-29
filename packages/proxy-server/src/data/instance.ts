import { Schema as S } from "effect";

import { lowercaseUUID } from "../schema/uuid";

export enum jtlProduct {
	"erp-api" = "erp-api",
	"ameise" = "ameise",
	"wms-mobile" = "wms-mobile",
	"pos" = "pos",
}

/**
 * Unique identifier for an instance.
 *
 * WARNING: those field names are taken and used as unique constraint in the Cosmosdb.
 *
 * Each Change requires migration to be done
 */
export const InstanceIdentifier = S.Struct({
	/**
	 * UUID of the Tenant
	 */
	tenantId: lowercaseUUID,
	/**
	 * Product of the instance
	 */
	product: S.Enums(jtlProduct),
	/**
	 * Instance ID of the instance. Can be anything, set by the client.
	 * If not provided, defaults to "default".
	 */
	instanceId: S.optionalWith(S.String, {
		default: () => "default",
	}),
});
export type InstanceIdentifier = S.Schema.Type<typeof InstanceIdentifier>;
