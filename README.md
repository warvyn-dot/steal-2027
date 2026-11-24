# Steal 2027

Sean and Grace's GTA-themed New Year's Eve site. Guests RSVP, claim a drink from the game, or add something that's not on the list. The crew dashboard (`admin.html`) shows everything, behind a PIN.

- **Database:** Supabase (Postgres). The page talks to it directly from the browser.
- **Code:** this GitHub repo.
- **Hosting:** Cloudflare Pages, which redeploys every time you push.

No build step, no framework: plain HTML, CSS and JavaScript.

## Files

| File | What it is |
|---|---|
| `index.html`, `app.js` | Guest app with four tabs: Home (invite + RSVP with plus-one names), Dress code, Drinks (claims + write-ins), Location (map + directions) |
| `manifest.webmanifest`, `assets/icons/` | Lets guests add the site to their home screen like an app |
| `admin.html`, `admin.js` | Crew dashboard behind the PIN |
| `shared.js` | Database calls, theme toggle, header art |
| `styles.css` | The Afterglow look, night and day themes |
| `config.js` | Your Supabase URL and anon key (fill in once) |
| `supabase/schema.sql` | Tables, security rules and functions |
| `assets/headers/` | Pricedown header art (outlined SVGs) |
| `assets/img/` | Day and night background art |

## Setup (about 10 minutes)

### 1. Supabase

1. Create a project at supabase.com. Pick a region near Dallas, like East US.
2. Open **SQL Editor**, then **New query**. Paste all of `supabase/schema.sql` and click **Run**.
3. Open **Project Settings**, then **API** (or the **Connect** button). Copy the **Project URL** and the **anon** (publishable) key into `config.js`.

The anon key is designed to be public. Every table is locked, and the browser can only call the functions in `schema.sql`.

### 2. GitHub

1. Create a new repository, for example `steal-2027`.
2. Upload or push every file in this folder, keeping the folders as they are.

### 3. Cloudflare Pages

1. In Cloudflare, open **Workers & Pages**, then **Create**, then **Pages**, then **Connect to Git**, and pick the repo.
2. Framework preset: **None**. Build command: leave it empty. Output directory: `/`.
3. Deploy. Your link will look like `steal-2027.pages.dev`. Text that to guests.

The crew dashboard is at `/admin.html` on the same link.

## The PIN

- The PIN is checked inside the database, not in the page, so reading the page's code doesn't reveal it. It's stored hashed.
- Ten wrong tries in 15 minutes locks the dashboard for the rest of that window.
- A 4-digit PIN is fine for a party, but someone determined could still guess it, so only names, headcounts and drinks are collected. No phone numbers or addresses.
- To change the PIN, run this in the Supabase SQL Editor:

```sql
update public.admin_settings set pin_hash = extensions.crypt('NEWPIN', extensions.gen_salt('bf')) where id = 1;
```

## Changing the drink list

Drinks live in the `drinks` table, and each `id` matches its header art number (12 to 23). Adding a new drink needs a new Pricedown SVG in `assets/headers/` plus an entry in `HEADERS` in `shared.js`. Without art, the name shows as plain text.

## Heads-up

Running `schema.sql` again resets everything and deletes all RSVPs and claims. Only re-run it before the invite goes out.
