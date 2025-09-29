# Handshake flow

1. On connected, the server (tunnel) will receive the connectionId + tenantId, it will send challenge request to client (in memory storage, not store to db yet), attach the response channel to client
2. client receives the challenge request, send back the challenge response to the group, if the challenge is valid, server will add the client to the connections storage, otherwise remove the client from the hub (disconnect the client)