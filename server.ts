import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === "1";
const dbPath = isVercel 
  ? path.join("/tmp", "family_link.db")
  : path.join(__dirname, "family_link.db");

let db: any;

async function initDb() {
  console.log("Initializing database...");
  try {
    console.log("Attempting to import better-sqlite3...");
    const Database = (await import("better-sqlite3")).default;
    console.log("Opening database at:", dbPath);
    db = new Database(dbPath);
    console.log("Database opened successfully.");
    // Initialize DB
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      role TEXT,
      family_code TEXT,
      bio TEXT,
      profile_picture TEXT,
      theme TEXT DEFAULT 'warm',
      font TEXT DEFAULT 'serif',
      status TEXT DEFAULT 'online'
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      family_code TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      quoted_message_id INTEGER,
      attachment_url TEXT,
      FOREIGN KEY(sender_id) REFERENCES users(id),
      FOREIGN KEY(quoted_message_id) REFERENCES messages(id)
    );
    CREATE TABLE IF NOT EXISTS message_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER,
      user_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id),
      FOREIGN KEY(message_id) REFERENCES messages(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS message_reactions (
      message_id INTEGER,
      user_id INTEGER,
      emoji TEXT,
      PRIMARY KEY (message_id, user_id, emoji),
      FOREIGN KEY(message_id) REFERENCES messages(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_code TEXT,
      type TEXT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  } catch (error) {
    console.error("Database initialization error:", error);
    // Fallback to in-memory if file fails
    try {
      const Database = (await import("better-sqlite3")).default;
      db = new Database(":memory:");
    } catch (e) {
      console.error("Failed to even initialize in-memory DB:", e);
    }
  }
}

async function startServer() {
  console.log("Starting server function...");
  await initDb();
  console.log("Database initialization finished.");
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health/basic", (req, res) => {
    res.json({ status: "ok", message: "Server is running", time: new Date().toISOString() });
  });

  app.get("/api/health", (req, res) => {
    try {
      if (!db) {
        return res.json({ status: "ok", database: "not_initialized_yet", note: "DB is being initialized asynchronously" });
      }
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
      res.json({ status: "ok", database: "connected", users: userCount.count });
    } catch (error) {
      res.status(500).json({ status: "error", database: "error", message: (error as Error).message });
    }
  });

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, familyCode, role } = req.body;
    console.log(`Login attempt: ${username} with code ${familyCode}`);
    try {
      let user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      
      if (user) {
        if (user.family_code !== familyCode) {
          console.log(`Login failed: Incorrect family code for ${username}`);
          return res.status(401).json({ error: "Incorrect family code for this username." });
        }
      } else {
        console.log(`Creating new user: ${username} as ${role}`);
        const info = db.prepare("INSERT INTO users (username, role, family_code) VALUES (?, ?, ?)").run(username, role, familyCode);
        user = { id: info.lastInsertRowid, username, role, family_code: familyCode, bio: "", profile_picture: "" };
        
        // Log activity
        db.prepare("INSERT INTO activity_log (family_code, type, content) VALUES (?, ?, ?)").run(familyCode, "join", `${username} joined the family sanctuary.`);
      }
      res.json(user);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login. Database error." });
    }
  });

  app.post("/api/profile/update", (req, res) => {
    const { userId, bio, profile_picture, theme, font, status } = req.body;
    try {
      db.prepare("UPDATE users SET bio = ?, profile_picture = ?, theme = ?, font = ?, status = ? WHERE id = ?")
        .run(bio, profile_picture, theme || 'warm', font || 'serif', status || 'online', userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/messages/:familyCode", (req, res) => {
    const { familyCode } = req.params;
    const { q, sender, startDate, endDate, archived } = req.query;
    
    let query = `
      SELECT m.*, u.username as sender_name, u.role as sender_role, u.profile_picture as sender_avatar,
      (SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id) as read_count,
      (SELECT GROUP_CONCAT(emoji || ':' || user_id) FROM message_reactions mr WHERE mr.message_id = m.id) as reactions,
      qm.content as quoted_content, qu.username as quoted_sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages qm ON m.quoted_message_id = qm.id
      LEFT JOIN users qu ON qm.sender_id = qu.id
      WHERE m.family_code = ? AND m.is_deleted = 0 AND m.is_archived = ?
    `;
    
    const params: any[] = [familyCode, archived === 'true' ? 1 : 0];
    
    if (q) {
      query += " AND m.content LIKE ?";
      params.push(`%${q}%`);
    }
    if (sender) {
      query += " AND u.username = ?";
      params.push(sender);
    }
    if (startDate) {
      query += " AND m.timestamp >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND m.timestamp <= ?";
      params.push(endDate);
    }
    
    query += " ORDER BY m.timestamp ASC LIMIT 200";
    
    const messages = db.prepare(query).all(...params) as any[];
    res.json(messages);
  });

  app.post("/api/messages/delete", (req, res) => {
    const { messageId, userId } = req.body;
    try {
      const msg = db.prepare("SELECT sender_id FROM messages WHERE id = ?").get(messageId) as any;
      if (msg && msg.sender_id === userId) {
        db.prepare("UPDATE messages SET is_deleted = 1 WHERE id = ?").run(messageId);
        res.json({ success: true });
      } else {
        res.status(403).json({ error: "Unauthorized" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  app.get("/api/activity/:familyCode", (req, res) => {
    const { familyCode } = req.params;
    const logs = db.prepare("SELECT * FROM activity_log WHERE family_code = ? ORDER BY timestamp DESC LIMIT 50").all(familyCode);
    res.json(logs);
  });

  app.get("/api/messages/pinned/:familyCode", (req, res) => {
    const { familyCode } = req.params;
    try {
      const query = `
        SELECT m.*, u.username as sender_name, u.role as sender_role, u.profile_picture as sender_avatar,
        (SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id) as read_count,
        (SELECT GROUP_CONCAT(emoji || ':' || user_id) FROM message_reactions mr WHERE mr.message_id = m.id) as reactions,
        qm.content as quoted_content, qu.username as quoted_sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages qm ON m.quoted_message_id = qm.id
        LEFT JOIN users qu ON qm.sender_id = qu.id
        WHERE m.family_code = ? AND m.is_deleted = 0 AND m.is_pinned = 1
        ORDER BY m.timestamp DESC
      `;
      const messages = db.prepare(query).all(familyCode) as any[];
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pinned messages" });
    }
  });

  app.post("/api/messages/pin", (req, res) => {
    const { messageId, isPinned } = req.body;
    try {
      db.prepare("UPDATE messages SET is_pinned = ? WHERE id = ?").run(isPinned ? 1 : 0, messageId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to pin message" });
    }
  });

  app.post("/api/messages/archive", (req, res) => {
    const { messageId, isArchived } = req.body;
    try {
      db.prepare("UPDATE messages SET is_archived = ? WHERE id = ?").run(isArchived ? 1 : 0, messageId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to archive message" });
    }
  });

  app.post("/api/messages/react", (req, res) => {
    const { messageId, userId, emoji, action } = req.body;
    try {
      if (action === "add") {
        db.prepare("INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)").run(messageId, userId, emoji);
      } else {
        db.prepare("DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?").run(messageId, userId, emoji);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to react" });
    }
  });

  app.post("/api/messages/read", (req, res) => {
    const { messageIds, userId } = req.body;
    try {
      const insert = db.prepare("INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)");
      const transaction = db.transaction((ids: number[]) => {
        for (const id of ids) insert.run(id, userId);
      });
      transaction(messageIds);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark as read" });
    }
  });

  app.get("/api/presence/:familyCode", (req, res) => {
    const { familyCode } = req.params;
    const users = db.prepare("SELECT id, username, status, role, bio, profile_picture FROM users WHERE family_code = ?").all(familyCode);
    res.json(users);
  });

  // WebSocket handling
  const clients = new Map<WebSocket, { familyCode: string; userId: number }>();

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === "join") {
        clients.set(ws, { familyCode: message.familyCode, userId: message.userId });
        db.prepare("UPDATE users SET status = 'online' WHERE id = ?").run(message.userId);
        
        // Broadcast presence to others
        const broadcastMsg = JSON.stringify({ type: "presence", userId: message.userId, status: "online" });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(broadcastMsg);
        });

        // Send current presence of others to the new user
        const familyUsers = db.prepare("SELECT id, status FROM users WHERE family_code = ?").all(message.familyCode) as any[];
        familyUsers.forEach(u => {
          if (u.id !== message.userId) {
            ws.send(JSON.stringify({ type: "presence", userId: u.id, status: u.status }));
          }
        });
      } else if (message.type === "status") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          db.prepare("UPDATE users SET status = ? WHERE id = ?").run(message.status, clientInfo.userId);
          const broadcastMsg = JSON.stringify({ type: "presence", userId: clientInfo.userId, status: message.status });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) client.send(broadcastMsg);
          });
        }
      } else if (message.type === "typing") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          const broadcastMsg = JSON.stringify({
            type: "typing",
            userId: clientInfo.userId,
            username: message.username,
            isTyping: message.isTyping,
            familyCode: clientInfo.familyCode
          });
          wss.clients.forEach((client) => {
            const info = clients.get(client);
            if (client !== ws && client.readyState === WebSocket.OPEN && info?.familyCode === clientInfo.familyCode) {
              client.send(broadcastMsg);
            }
          });
        }
      } else if (message.type === "read") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          const broadcastMsg = JSON.stringify({
            type: "read",
            messageId: message.messageId,
            userId: clientInfo.userId,
            familyCode: clientInfo.familyCode
          });
          wss.clients.forEach((client) => {
            const info = clients.get(client);
            if (client.readyState === WebSocket.OPEN && info?.familyCode === clientInfo.familyCode) {
              client.send(broadcastMsg);
            }
          });
        }
      } else if (message.type === "react") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          wss.clients.forEach((client) => {
            const info = clients.get(client);
            if (client.readyState === WebSocket.OPEN && info?.familyCode === clientInfo.familyCode) {
              client.send(JSON.stringify(message));
            }
          });
        }
      } else if (message.type === "pin") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          wss.clients.forEach((client) => {
            const info = clients.get(client);
            if (client.readyState === WebSocket.OPEN && info?.familyCode === clientInfo.familyCode) {
              client.send(JSON.stringify(message));
            }
          });
        }
      } else if (message.type === "archive") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          wss.clients.forEach((client) => {
            const info = clients.get(client);
            if (client.readyState === WebSocket.OPEN && info?.familyCode === clientInfo.familyCode) {
              client.send(JSON.stringify(message));
            }
          });
        }
      } else if (message.type === "delete") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          wss.clients.forEach((client) => {
            const info = clients.get(client);
            if (client.readyState === WebSocket.OPEN && info?.familyCode === clientInfo.familyCode) {
              client.send(JSON.stringify(message));
            }
          });
        }
      } else if (message.type === "call_signal") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          wss.clients.forEach((client) => {
            const info = clients.get(client);
            if (client !== ws && client.readyState === WebSocket.OPEN && info?.familyCode === clientInfo.familyCode) {
              client.send(JSON.stringify(message));
            }
          });
        }
      } else if (message.type === "chat") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          const { content, quoted_message_id, attachment_url } = message;
          const info = db.prepare("INSERT INTO messages (sender_id, content, family_code, quoted_message_id, attachment_url) VALUES (?, ?, ?, ?, ?)").run(clientInfo.userId, content, clientInfo.familyCode, quoted_message_id || null, attachment_url || null);
          
          const user = db.prepare("SELECT username, role FROM users WHERE id = ?").get(clientInfo.userId) as any;
          
          let quoted_content = null;
          let quoted_sender_name = null;
          if (quoted_message_id) {
            const qm = db.prepare("SELECT m.content, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?").get(quoted_message_id) as any;
            if (qm) {
              quoted_content = qm.content;
              quoted_sender_name = qm.username;
            }
          }

          const broadcastMsg = JSON.stringify({
            type: "chat",
            id: info.lastInsertRowid,
            sender_id: clientInfo.userId,
            sender_name: user.username,
            sender_role: user.role,
            content,
            timestamp: new Date().toISOString(),
            family_code: clientInfo.familyCode,
            quoted_message_id,
            quoted_content,
            quoted_sender_name,
            attachment_url
          });

          wss.clients.forEach((client) => {
            const info = clients.get(client);
            if (client.readyState === WebSocket.OPEN && info?.familyCode === clientInfo.familyCode) {
              client.send(broadcastMsg);
            }
          });
        }
      }
    });

    ws.on("close", () => {
      const clientInfo = clients.get(ws);
      if (clientInfo) {
        db.prepare("UPDATE users SET status = 'offline' WHERE id = ?").run(clientInfo.userId);
        const broadcastMsg = JSON.stringify({ type: "presence", userId: clientInfo.userId, status: "offline" });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(broadcastMsg);
        });
      }
      clients.delete(ws);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (!isVercel) {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  
  return app;
}

const appPromise = startServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
