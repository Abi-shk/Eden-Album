const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const path = require("path");

const adapter = new FileSync(path.join(__dirname, "data", "db.json"));
const db = low(adapter);

db.defaults({
  users: [],
  eventTypes: [],
  events: [],
  photos: [],
  layouts: [],
  albums: []
}).write();

// ---- Seed data (only runs once, on an empty database) ----
if (db.get("users").size().value() === 0) {
  db.get("users")
    .push({
      id: nanoid(10),
      name: "Studio Admin",
      email: "admin@studio.com",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "admin",
      authProvider: "admin_created",
      createdAt: new Date().toISOString()
    })
    .write();
}

if (db.get("eventTypes").size().value() === 0) {
  ["Wedding", "Pre-Wedding", "Baptism", "Engagement", "Anniversary"].forEach((name) => {
    db.get("eventTypes")
      .push({ id: nanoid(8), name })
      .write();
  });
}

if (db.get("layouts").size().value() === 0) {
  const presets = [
    { name: "Classic Grid", accent: "#C97B84", cols: 3 },
    { name: "Full Bleed Spread", accent: "#6B7A5E", cols: 1 },
    { name: "Story Timeline", accent: "#B08968", cols: 2 },
    { name: "Polaroid Scatter", accent: "#7A6A8A", cols: 4 }
  ];
  presets.forEach((p) => {
    db.get("layouts")
      .push({
        id: nanoid(8),
        name: p.name,
        type: "preset",
        accent: p.accent,
        cols: p.cols,
        createdBy: "Studio",
        createdAt: new Date().toISOString()
      })
      .write();
  });
}

module.exports = db;
