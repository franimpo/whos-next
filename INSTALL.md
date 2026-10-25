# Who's Next? — Installation

## 1. Install

From this folder:

```bash
npm install
```

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_YOUR_SECRET_KEY
VOTER_HASH_SALT=replace-with-a-long-random-string
ADMIN_PASSWORD=replace-with-your-admin-password
```

Important: `SUPABASE_SECRET_KEY` must be the private `sb_secret_...` key (or legacy `service_role` key), not the publishable/anon key.

## 3. Database

Open Supabase -> SQL Editor, open `supabase/schema.sql`, copy the SQL contents and run them.

Do **not** type `supabase/schema.sql` into the SQL editor; paste the contents of the file.

## 4. Run locally

```bash
npm run dev
```

Open:

- Site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- API check: `http://localhost:3000/api/leaderboard`

The admin password is the value of `ADMIN_PASSWORD` in `.env.local`.

## Closing a round

Open `/admin`, choose the person who passed away, enter the actual date of death, and click **Close case & start new round**.

The old votes remain stored and are shown in the historical archive. A fresh active round is created automatically.

## Netlify

Push the project to GitHub, import the repository into Netlify, and add the same four environment variables under Netlify's Environment variables settings.

Use:

```text
Build command: npm run build
```

Netlify detects Next.js automatically. Do not commit `.env.local`.
