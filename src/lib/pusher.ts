import Pusher from "pusher";

// Next.js singleton pattern — prevents multiple Pusher instances during
// hot-reload in development (module cache gets cleared on each file save).
declare global {
  // eslint-disable-next-line no-var
  var pusherServer: Pusher | undefined;
}

export const pusherServer =
  global.pusherServer ??
  new Pusher({
    appId:   process.env.PUSHER_APP_ID!,
    key:     process.env.PUSHER_KEY!,
    secret:  process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS:  true,
  });

if (process.env.NODE_ENV !== "production") {
  global.pusherServer = pusherServer;
}
