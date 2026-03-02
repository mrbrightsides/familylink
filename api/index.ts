import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Health checks
app.get("/api/health/basic", (req, res) => {
  res.json({ status: "ok", message: "Server is running on Vercel", time: new Date().toISOString() });
});

app.get("/api/health", async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("count", { count: "exact", head: true });
    if (error) throw error;
    res.json({ status: "ok", database: "connected", users: data });
  } catch (error) {
    res.status(500).json({ status: "error", database: "error", message: (error as Error).message });
  }
});

// Auth Routes
app.post("/api/login", async (req, res) => {
  const { username, familyCode, role } = req.body;
  try {
    // Check if user exists
    let { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (user) {
      if (user.family_code !== familyCode) {
        return res.status(401).json({ error: "Incorrect family code for this username." });
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert([{ username, role, family_code: familyCode }])
        .select()
        .single();

      if (createError) throw createError;
      user = newUser;

      // Log activity
      await supabase.from("activity_log").insert([
        { family_code: familyCode, type: "join", content: `${username} joined the family sanctuary.` }
      ]);
    }
    res.json(user);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login. Database error." });
  }
});

app.post("/api/profile/update", async (req, res) => {
  const { userId, bio, profile_picture, theme, font, status } = req.body;
  try {
    const { error } = await supabase
      .from("users")
      .update({ bio, profile_picture, theme, font, status })
      .eq("id", userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Message Routes
app.get("/api/messages/:familyCode", async (req, res) => {
  const { familyCode } = req.params;
  const { q, archived } = req.query;

  try {
    let query = supabase
      .from("messages")
      .select(`
        *,
        sender:users!sender_id(username, role, profile_picture),
        quoted_message:messages!quoted_message_id(content, sender:users!sender_id(username))
      `)
      .eq("family_code", familyCode)
      .eq("is_deleted", false)
      .eq("is_archived", archived === "true");

    if (q) {
      query = query.ilike("content", `%${q}%`);
    }

    const { data: messages, error } = await query.order("timestamp", { ascending: true }).limit(200);

    if (error) throw error;

    // Transform data to match frontend expectations
    const transformed = messages.map(m => ({
      ...m,
      sender_name: m.sender.username,
      sender_role: m.sender.role,
      sender_avatar: m.sender.profile_picture,
      quoted_content: m.quoted_message?.content,
      quoted_sender_name: m.quoted_message?.sender?.username
    }));

    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.post("/api/messages/delete", async (req, res) => {
  const { messageId, userId } = req.body;
  try {
    const { data: msg, error: fetchError } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("id", messageId)
      .single();

    if (fetchError || !msg) throw fetchError || new Error("Message not found");

    if (msg.sender_id === userId) {
      const { error: updateError } = await supabase
        .from("messages")
        .update({ is_deleted: true })
        .eq("id", messageId);
      if (updateError) throw updateError;
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

app.get("/api/activity/:familyCode", async (req, res) => {
  const { familyCode } = req.params;
  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .eq("family_code", familyCode)
      .order("timestamp", { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

app.get("/api/messages/pinned/:familyCode", async (req, res) => {
  const { familyCode } = req.params;
  try {
    const { data: messages, error } = await supabase
      .from("messages")
      .select(`
        *,
        sender:users!sender_id(username, role, profile_picture),
        quoted_message:messages!quoted_message_id(content, sender:users!sender_id(username))
      `)
      .eq("family_code", familyCode)
      .eq("is_deleted", false)
      .eq("is_pinned", true)
      .order("timestamp", { ascending: false });

    if (error) throw error;

    const transformed = messages.map(m => ({
      ...m,
      sender_name: m.sender.username,
      sender_role: m.sender.role,
      sender_avatar: m.sender.profile_picture,
      quoted_content: m.quoted_message?.content,
      quoted_sender_name: m.quoted_message?.sender?.username
    }));

    res.json(transformed);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pinned messages" });
  }
});

app.post("/api/messages/pin", async (req, res) => {
  const { messageId, isPinned } = req.body;
  try {
    const { error } = await supabase
      .from("messages")
      .update({ is_pinned: isPinned })
      .eq("id", messageId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to pin message" });
  }
});

app.post("/api/messages/archive", async (req, res) => {
  const { messageId, isArchived } = req.body;
  try {
    const { error } = await supabase
      .from("messages")
      .update({ is_archived: isArchived })
      .eq("id", messageId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to archive message" });
  }
});

app.post("/api/messages/react", async (req, res) => {
  const { messageId, userId, emoji, action } = req.body;
  try {
    if (action === "add") {
      const { error } = await supabase
        .from("message_reactions")
        .upsert({ message_id: messageId, user_id: userId, emoji });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .match({ message_id: messageId, user_id: userId, emoji });
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to react" });
  }
});

app.post("/api/messages/read", async (req, res) => {
  const { messageIds, userId } = req.body;
  try {
    const inserts = messageIds.map((id: number) => ({ message_id: id, user_id: userId }));
    const { error } = await supabase
      .from("message_reads")
      .upsert(inserts, { onConflict: "message_id,user_id" });
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

app.get("/api/presence/:familyCode", async (req, res) => {
  const { familyCode } = req.params;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, status, role, bio, profile_picture")
      .eq("family_code", familyCode);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch presence" });
  }
});

// ... Other routes would go here, but for now let's focus on getting it running ...

export default app;
