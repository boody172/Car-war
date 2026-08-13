// Free *.workers.dev deployment target for the multiplayer room server —
// routes `/parties/room/<roomId>` (the exact path partysocket already
// requests, unchanged on the client) to a Durable Object instance keyed by
// roomId. See RoomObject.ts for how that instance runs the real game logic.
export { RoomObject } from "./RoomObject";

interface Env {
  ROOMS: DurableObjectNamespace;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] !== "parties" || parts.length < 3) {
      return new Response("Not found", { status: 404 });
    }

    const roomId = parts[2];
    const id = env.ROOMS.idFromName(roomId);
    const stub = env.ROOMS.get(id);
    return stub.fetch(request);
  },
};

export default worker;
