# Overview

On starting, connect to the proxy server and request a token for authentication.
Use the token to connect to the Azure Web PubSub service.

On receiving message from server hub, if the message type = 'proxy' then use the proxy-service to forward the message to the target service and then send the response back to the server hub (group)