import { getAuth } from "firebase-admin/auth";
import firebaseApp from "../config/firebaseAdmin.js";
import User from "../../models/user.js";

// live broadcast while people are online
const partyRooms = new Map();

export default function initPlazaSocket(io) {
  const plaza = io.of("/plaza");

  // auth handshake
  plaza.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));

      const decoded = await getAuth(firebaseApp).verifyIdToken(token);
      const user = await User.findOne({ firebaseUid: decoded.uid });

      if (!user) return next(new Error("No matching profile"));
      if (!user.partyId) return next(new Error("Not in a party"));

      socket.userId = user._id.toString();
      socket.partyId = user.partyId.toString();
      socket.username = user.username;
      socket.avatarId = user.avatarId;
      socket.rank = user.rank;
      socket.startX = user.plazaPosition?.x ?? 0.5;
      socket.startY = user.plazaPosition?.y ?? 0.6;

      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  plaza.on("connection", (socket) => {
    const room = `party:${socket.partyId}`;
    socket.join(room);

    if (!partyRooms.has(socket.partyId)) {
      partyRooms.set(socket.partyId, new Map());
    }
    const members = partyRooms.get(socket.partyId);

    const me = {
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username,
      avatarId: socket.avatarId,
      rank: socket.rank,
      x: socket.startX,
      y: socket.startY,
    };
    members.set(socket.id, me);

    // snapshot of everyone currently online in this party, sent only to the new joiner
    socket.emit(
      "plaza:snapshot",
      Array.from(members.values()).filter((m) => m.socketId !== socket.id),
    );

    // tell everyone else in the room someone just showed up
    socket.to(room).emit("plaza:userJoined", me);

    // live movement movement  
    // the server just relays whatever it gets.
    socket.on("plaza:move", ({ x, y }) => {
      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        x < 0 ||
        x > 1 ||
        y < 0 ||
        y > 1
      ) {
        return; // ignore malformed/out-of-range input, don't crash the socket
      }

      const state = members.get(socket.id);
      if (!state) return;
      state.x = x;
      state.y = y;

      socket.to(room).emit("plaza:userMoved", {
        userId: socket.userId,
        x,
        y,
      });
    });

    socket.on("disconnect", () => {
      members.delete(socket.id);
      socket.to(room).emit("plaza:userLeft", { userId: socket.userId });
      if (members.size === 0) partyRooms.delete(socket.partyId);
    });
  });
}
