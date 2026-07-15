const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const path = require("path");
const fs = require("fs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid(12)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "wedding-album-app-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
  })
);
app.use(express.static(path.join(__dirname, "public")));

// ---------- helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin")
    return res.status(403).json({ error: "Admin access required" });
  next();
}
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

// ============ AUTH ============
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.get("users").find({ email: (email || "").toLowerCase().trim() }).value();
  if (!user) return res.status(401).json({ error: "No account found with that email" });
  if (user.authProvider === "google")
    return res.status(400).json({ error: "This account uses Google sign-in" });
  if (!bcrypt.compareSync(password || "", user.passwordHash))
    return res.status(401).json({ error: "Incorrect password" });
  req.session.user = publicUser(user);
  res.json({ user: publicUser(user) });
});

// Simulated Google sign-in for the prototype (no real OAuth wired up).
// In production, swap this for real Google OAuth via Supabase/Firebase Auth.
app.post("/api/auth/google-demo", (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Name and email required" });
  const normalizedEmail = email.toLowerCase().trim();
  let user = db.get("users").find({ email: normalizedEmail }).value();
  if (!user) {
    user = {
      id: nanoid(10),
      name,
      email: normalizedEmail,
      passwordHash: null,
      role: "client",
      authProvider: "google",
      createdAt: new Date().toISOString()
    };
    db.get("users").push(user).write();
  }
  req.session.user = publicUser(user);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

// ============ EVENT TYPES ============
app.get("/api/event-types", requireAuth, (req, res) => {
  res.json(db.get("eventTypes").value());
});

app.post("/api/admin/event-types", requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name required" });
  const item = { id: nanoid(8), name: name.trim() };
  db.get("eventTypes").push(item).write();
  res.json(item);
});

app.delete("/api/admin/event-types/:id", requireAdmin, (req, res) => {
  db.get("eventTypes").remove({ id: req.params.id }).write();
  res.json({ ok: true });
});

// ============ CLIENTS (admin-managed) ============
app.get("/api/admin/clients", requireAdmin, (req, res) => {
  const clients = db.get("users").filter({ role: "client" }).value().map(publicUser);
  res.json(clients);
});

app.post("/api/admin/clients", requireAdmin, (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password required" });
  const normalizedEmail = email.toLowerCase().trim();
  if (db.get("users").find({ email: normalizedEmail }).value())
    return res.status(400).json({ error: "A user with that email already exists" });
  const user = {
    id: nanoid(10),
    name,
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    role: "client",
    authProvider: "admin_created",
    createdAt: new Date().toISOString()
  };
  db.get("users").push(user).write();
  res.json(publicUser(user));
});

app.delete("/api/admin/clients/:id", requireAdmin, (req, res) => {
  db.get("users").remove({ id: req.params.id, role: "client" }).write();
  res.json({ ok: true });
});

// ============ LAYOUTS ============
app.get("/api/layouts", requireAuth, (req, res) => {
  res.json(db.get("layouts").value());
});

app.post("/api/admin/layouts", requireAdmin, upload.single("thumbnail"), (req, res) => {
  const { name, cols, accent } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Layout name required" });
  const layout = {
    id: nanoid(8),
    name: name.trim(),
    type: "custom_admin_upload",
    accent: accent || "#C97B84",
    cols: Number(cols) || 2,
    thumbnailUrl: req.file ? `/uploads/${req.file.filename}` : null,
    createdBy: req.session.user.name,
    createdAt: new Date().toISOString()
  };
  db.get("layouts").push(layout).write();
  res.json(layout);
});

app.delete("/api/admin/layouts/:id", requireAdmin, (req, res) => {
  db.get("layouts").remove({ id: req.params.id }).write();
  res.json({ ok: true });
});

// ============ EVENTS ============
app.get("/api/events", requireAuth, (req, res) => {
  const { user } = req.session;
  const events =
    user.role === "admin"
      ? db.get("events").value()
      : db.get("events").filter({ clientId: user.id }).value();

  const enriched = events.map((e) => enrichEvent(e));
  res.json(enriched);
});

app.post("/api/events", requireAuth, (req, res) => {
  const { eventType } = req.body;
  if (!eventType) return res.status(400).json({ error: "Event type required" });
  const event = {
    id: nanoid(10),
    clientId: req.session.user.id,
    eventType,
    status: "created",
    createdAt: new Date().toISOString()
  };
  db.get("events").push(event).write();
  res.json(enrichEvent(event));
});

function enrichEvent(event) {
  const photos = db.get("photos").filter({ eventId: event.id }).value();
  const album = db.get("albums").find({ eventId: event.id }).value();
  const client = db.get("users").find({ id: event.clientId }).value();
  return {
    ...event,
    photoCount: photos.length,
    album: album || null,
    clientName: client ? client.name : "Unknown"
  };
}

// ============ PHOTOS ============
app.post("/api/events/:id/photos", requireAuth, upload.array("photos", 30), (req, res) => {
  const event = db.get("events").find({ id: req.params.id }).value();
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (req.session.user.role !== "admin" && event.clientId !== req.session.user.id)
    return res.status(403).json({ error: "Not your event" });

  const added = (req.files || []).map((f) => {
    const photo = {
      id: nanoid(10),
      eventId: event.id,
      source: "upload",
      url: `/uploads/${f.filename}`,
      createdAt: new Date().toISOString()
    };
    db.get("photos").push(photo).write();
    return photo;
  });
  res.json({ added });
});

app.post("/api/events/:id/drive-link", requireAuth, (req, res) => {
  const event = db.get("events").find({ id: req.params.id }).value();
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (req.session.user.role !== "admin" && event.clientId !== req.session.user.id)
    return res.status(403).json({ error: "Not your event" });
  const { driveUrl } = req.body;
  if (!driveUrl || !driveUrl.includes("drive.google.com"))
    return res.status(400).json({ error: "Please paste a valid Google Drive link" });
  const photo = {
    id: nanoid(10),
    eventId: event.id,
    source: "drive_link",
    url: driveUrl,
    createdAt: new Date().toISOString()
  };
  db.get("photos").push(photo).write();
  res.json({ added: [photo] });
});

app.get("/api/events/:id/photos", requireAuth, (req, res) => {
  const event = db.get("events").find({ id: req.params.id }).value();
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (req.session.user.role !== "admin" && event.clientId !== req.session.user.id)
    return res.status(403).json({ error: "Not your event" });
  res.json(db.get("photos").filter({ eventId: event.id }).value());
});

// ============ ALBUMS ============
app.post("/api/events/:id/album", requireAuth, (req, res) => {
  const event = db.get("events").find({ id: req.params.id }).value();
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (req.session.user.role !== "admin" && event.clientId !== req.session.user.id)
    return res.status(403).json({ error: "Not your event" });

  const { designMode, layoutId } = req.body; // "self" | "assigned_to_company"
  if (!["self", "assigned_to_company"].includes(designMode))
    return res.status(400).json({ error: "Invalid design mode" });

  let album = db.get("albums").find({ eventId: event.id }).value();
  const status = designMode === "self" ? "in_progress" : "queued_for_studio";

  if (album) {
    db.get("albums")
      .find({ id: album.id })
      .assign({ designMode, layoutId: layoutId || album.layoutId, status })
      .write();
  } else {
    album = {
      id: nanoid(10),
      eventId: event.id,
      layoutId: layoutId || null,
      designMode,
      status,
      createdAt: new Date().toISOString()
    };
    db.get("albums").push(album).write();
  }
  db.get("events").find({ id: event.id }).assign({ status: "in_progress" }).write();
  res.json(db.get("albums").find({ eventId: event.id }).value());
});

app.get("/api/admin/albums", requireAdmin, (req, res) => {
  const albums = db.get("albums").value().map((a) => {
    const event = db.get("events").find({ id: a.eventId }).value();
    const client = event ? db.get("users").find({ id: event.clientId }).value() : null;
    const layout = a.layoutId ? db.get("layouts").find({ id: a.layoutId }).value() : null;
    return {
      ...a,
      eventType: event ? event.eventType : "Unknown",
      clientName: client ? client.name : "Unknown",
      layoutName: layout ? layout.name : "Not chosen yet"
    };
  });
  res.json(albums);
});

app.post("/api/admin/albums/:id/assign", requireAdmin, (req, res) => {
  const { designMode } = req.body;
  if (!["self", "assigned_to_company"].includes(designMode))
    return res.status(400).json({ error: "Invalid design mode" });
  const status = designMode === "self" ? "in_progress" : "queued_for_studio";
  db.get("albums").find({ id: req.params.id }).assign({ designMode, status }).write();
  res.json(db.get("albums").find({ id: req.params.id }).value());
});

app.post("/api/admin/albums/:id/approve", requireAdmin, (req, res) => {
  db.get("albums").find({ id: req.params.id }).assign({ status: "approved" }).write();
  res.json(db.get("albums").find({ id: req.params.id }).value());
});

// ---------- fallback ----------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Wedding album app running at http://localhost:${PORT}`);
  console.log(`Admin login: admin@studio.com / admin123`);
});
