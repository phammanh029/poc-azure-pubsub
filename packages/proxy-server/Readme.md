# Overview

The server exposes the following endpoints:
/auth: for client to request the token to connect to Azure Web PubSub service. This will return the following info:
{
    endpoint: string; // Azure Web PubSub endpoint (token included)
    hub: string; // where the client should connect to
}

/events: this is the endpoint for Azure Web PubSub to send events to. this will be used for managing the websocket connection lifecycle (connect, connected, disconnected, etc). On connect, it will store the connectionId and the tenantId or name that will be sent from the client. Store it in valkey db, on disconnect, remove the connectionId from valkey db.

/proxy: this endpoint will be used for proxy the request from external system to the wawi, this receives request from user, then server sends request to client by looking up the connectionId from valkey db (by tenantId or name), then client will process the request and send back the response to server via group (pod-name, child of hub), then server will send back the response to the external system.