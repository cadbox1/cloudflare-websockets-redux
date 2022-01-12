async function handleSession(websocket, env) {
  websocket.accept();
  websocket.addEventListener("message", async ({ data }) => {
    const action = JSON.parse(data);
    const actionType = action.type;

    // @todo handle action with redux and update durable object state
    if (actionType === "message/message") {

      const downloadCounterId = "test";
      const downloadCounter = env.DOWNLOAD_COUNTER.get(
        env.DOWNLOAD_COUNTER.idFromString(downloadCounterId)
      );

      await downloadCounter.fetch("https://images.pages.dev/increment");

      // This isn't a real internet request, so the host is irrelevant (https://developers.cloudflare.com/workers/platform/compatibility-dates#durable-object-stubfetch-requires-a-full-url).
      const downloadCountResponse = await downloadCounter.fetch(
        "https://images.pages.dev/"
      );

      // @ts-ignore
      const downloadCount = await downloadCountResponse.json<number>();

      const TokMessage = {
        type: "message/message",
        payload: {
          value: `Count: ${downloadCount}`,
          timestamp: new Date().toISOString(),
        },
      };

      websocket.send(JSON.stringify(TokMessage));
    } else {
      // An unknown message came into the server. Send back an error message
      websocket.send(
        JSON.stringify({ type: "error", payload: "Unknown message received" })
      );
    }
  });

  websocket.addEventListener("close", async (evt) => {
    // Handle when a client closes the WebSocket connection
    console.log(evt);
  });
}

const websocketHandler = async (request, env) => {
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  // @ts-ignore
  const [client, server] = Object.values(new WebSocketPair());
  await handleSession(server, env);

  return new Response(null, {
    status: 101,
    // @ts-ignore
    webSocket: client,
  });
};

export const onRequest: PagesFunction<{
  DOWNLOAD_COUNTER: DurableObjectNamespace;
}> = async ({request, env}) => {
  try {
    return websocketHandler(request, env);
  } catch (err) {
    return new Response(err.toString());
  }
};
