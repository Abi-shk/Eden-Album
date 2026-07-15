# Thread & Frame — Wedding Album App (working prototype)

A running web app for a wedding photography studio: clients create albums, upload photos
(direct or Google Drive link), pick a layout or hand it to the studio, and everything is
controlled from an admin dashboard.

This is a **fully working prototype** — real login, real database, real file uploads — built
so you can run it today, show it to people, and use it as the foundation to deploy for free.

## Run it

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd wedding-album-app
npm install
npm start
```

Open **http://localhost:3000**

**Admin login:** `admin@studio.com` / `admin123`
**Clients:** created by the admin from the Clients tab, or via the "Continue with Google" button
on the login screen (simulated in this prototype — see "Going to production" below).

## What's included

- **Client portal** (`/client.html`) — create an album, choose the event type, upload photos or
  paste a Drive link, choose "I'll design it" vs "studio designs it," and pick a layout.
- **Admin portal** (`/admin.html`) — four tabs: Albums (view/reassign/approve everything),
  Clients (create logins), Event types (edit the dropdown clients see), Layouts (upload new
  templates, remove old ones).
- **Backend** (`server.js` + `db.js`) — Express API, session-based auth, file uploads via
  Multer, data stored in `data/db.json` (a JSON file — see below on swapping this for a real
  database).

## How it maps to the architecture doc

This follows the same data model and roles from the documentation: `users`, `events`,
`photos`, `layouts`, `albums`. Right now it runs on a local JSON file instead of Postgres,
and photo storage is local disk instead of a cloud bucket — both swaps are what "going to
production" below covers.

## Going to production (still free)

This prototype uses local storage so it runs anywhere with zero setup. To put it online for
real clients, on free tiers:

1. **Database** — swap `db.js` for [Supabase](https://supabase.com) (Postgres, free tier).
   The five tables map directly onto the schema in the documentation PDF.
2. **File storage** — swap the local `/uploads` folder for Supabase Storage or Firebase
   Storage (both have free tiers) so uploaded photos survive redeploys.
3. **Real Google sign-in** — replace `/api/auth/google-demo` with real Google OAuth. Supabase
   Auth and Firebase Auth both support this with a few lines of config once you register a
   free Google Cloud OAuth client.
4. **Google Drive photos** — wire up the Google Picker API so clients pick a Drive folder
   visually instead of pasting a link (the current drive-link field already stores what you need
   to build this on top of).
5. **Hosting** — deploy to [Vercel](https://vercel.com) or [Render](https://render.com) free tier.
6. **Passwords in transit** — once hosted, make sure the site runs on HTTPS (both platforms
   above provide this automatically) so login credentials aren't sent in plain text.

## Project structure

```
wedding-album-app/
  server.js          API routes + auth + file uploads
  db.js              Data layer (JSON file, seeded with an admin + preset layouts)
  data/db.json        The "database" — safe to delete to reset to a fresh seed
  public/
    index.html        Login
    client.html        Client dashboard
    admin.html          Admin dashboard
    css/style.css       Shared styling
    js/                  Frontend logic (app.js, client.js, admin.js)
    uploads/              Uploaded photos and layout thumbnails land here
```

## Notes on this prototype vs. a production app

- Auth uses cookie sessions in memory — fine for one server instance, would need a session
  store (e.g. Redis, or Supabase's built-in auth) once you deploy with multiple instances.
- There's no real layout *editor* yet (drag-and-drop photo placement) — clients currently pick
  a template, and the actual page design happens off-app or by the studio. Wiring in a canvas
  editor (Fabric.js/Konva.js, as noted in the docs) is the natural next step.
- No email sending yet — when an admin creates a client login, there's nowhere to send the
  password automatically; it's shown on-screen to copy and share manually.
