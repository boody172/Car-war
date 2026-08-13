// Adapts the existing PartyKit-shaped `RoomServer` (party/room.ts) onto a raw
// Cloudflare Durable Object, so the exact same, already-tested game logic can
// run on a free *.workers.dev subdomain instead of PartyKit's managed
// platform. RoomServer only ever touches four things on the PartyKit types
// it's built against — connection.id, connection.send/close/setState, and
// room.id/room.broadcast — so this file just shims those four onto the raw
// WebSocket + DurableObjectState primitives and hands the untouched class
// nothing it can tell the difference from.
import type * as Party from "partykit/server";
import RoomServer from "../party/room";

interface Env {
  ROOMS: DurableObjectNamespace;
}

export class RoomObject implements DurableObject {
  private roomServer: RoomServer | null = null;
  private sockets = new Map<string, WebSocket>();

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {
    void this.state;
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const roomId = parts[2] ?? "unknown";

    if (!this.roomServer) {
      const room = {
        id: roomId,
        broadcast: (msg: string, without?: string[]) => {
          for (const [connId, ws] of this.sockets) {
            if (without?.includes(connId)) continue;
            try {
              ws.send(msg);
            } catch {
              // socket already closed — its own close handler will clean it up
            }
          }
        },
      } as unknown as Party.Room;
      this.roomServer = new RoomServer(room);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade request", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const connId = crypto.randomUUID();
    this.sockets.set(connId, server);

    const connShim = {
      id: connId,
      send: (data: string) => {
        try {
          server.send(data);
        } catch {
          // socket already gone — nothing to do
        }
      },
      close: () => server.close(),
      setState: () => {
        // RoomServer only ever writes a `{ joined }` marker here and never
        // reads it back — safe to drop.
      },
    } as unknown as Party.Connection;

    this.roomServer.onConnect(connShim);

    server.addEventListener("message", (evt: MessageEvent) => {
      this.roomServer?.onMessage(evt.data as string, connShim);
    });

    const onGone = () => {
      this.sockets.delete(connId);
      this.roomServer?.onClose(connShim);
    };
    server.addEventListener("close", onGone);
    server.addEventListener("error", onGone);

    return new Response(null, { status: 101, webSocket: client });
  }
}
