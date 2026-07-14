# Куиз състезание · Quiz Competition

A fully static single-page application for running live quiz competitions, built
to be hosted on **GitHub Pages** with **Supabase** as the database and auth
provider. The host controls the game from a single device (laptop, tablet or
projector); teams do not need their own devices.

The visible interface is in **Bulgarian**; all source code, database names and
this documentation are in English.

> **No Supabase? No problem.** If the Supabase environment variables are absent,
> the app runs in **local demo mode** using `localStorage` and shows a banner.
> A seeded demo admin and sample quiz are created automatically.

## Tech stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui components (Radix primitives)
- React Router (**hash routing** via `createHashRouter`)
- React Hook Form + Zod validation
- Recharts (responsive horizontal bar charts)
- Supabase JS client (Postgres + Auth + Data API + Realtime)
- Vitest + React Testing Library for the scoring/ranking/tiebreaker logic

Static SPA only — no SSR, no custom Node backend, no paid UI libraries.

---

## 1. Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env      # optional — leave empty to run in local demo mode
npm run dev               # http://localhost:5173
```

In demo mode, log in with:

- **Email:** `admin@quiz.local`
- **Password:** `demo1234`

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and produce the production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run the unit tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |

---

## 2. Creating the Supabase project

1. Create a project at <https://supabase.com>.
2. In **Project Settings → API**, copy:
   - the **Project URL** → `VITE_SUPABASE_URL`
   - the **`anon` / publishable key** → `VITE_SUPABASE_ANON_KEY`
3. Put them in your `.env`:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
   ```

> ⚠️ **Only ever use the publishable (`anon`) key in the frontend.** The
> `service_role` key must never be committed, placed in `.env`, or exposed in
> the browser. All access control is enforced by Row Level Security.

---

## 3. Applying migrations

The SQL lives in `supabase/migrations/`, in order:

1. `0001_schema.sql` — tables, indexes, foreign keys, uniqueness constraints, triggers
2. `0002_rls.sql` — Row Level Security policies + role grants
3. `0003_functions_views.sql` — convenience view + realtime publication

**Option A — Supabase SQL editor.** Open each file and run them in order.

**Option B — Supabase CLI.**

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push        # applies files in supabase/migrations
```

### Seed data (optional)

`supabase/seed.sql` inserts one sample quiz owned by the **first** auth user.
So first **sign up once in the app**, then run:

```bash
supabase db execute --file supabase/seed.sql
```

or paste it into the SQL editor.

---

## 4. Configuring authentication

1. In **Authentication → Providers**, keep **Email** enabled.
2. For quick testing, **Authentication → Providers → Email → disable
   "Confirm email"** so sign-up logs you straight in. (Re-enable it for
   production and configure an SMTP sender.)
3. A `profiles` row is created automatically on sign-up by the
   `handle_new_user` trigger (from `0001_schema.sql`), using the `display_name`
   passed at registration.

Admins register/log in through `#/login`. All administration routes require
authentication; the public scoreboard (`#/public/:sessionId`) is the only route
reachable without a session, and only when the game enables public viewing.

---

## 5. Deploying to GitHub Pages

The included workflow `.github/workflows/deploy.yml` builds and deploys on every
push to `main`.

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. (Optional) **Settings → Secrets and variables → Actions** → add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If omitted, the deployed
   site runs in local demo mode.
4. Push to `main`. The site publishes at
   `https://<user>.github.io/<repo>/`.

### Base path

`vite.config.ts` derives the base path automatically:

- On GitHub Actions it reads `GITHUB_REPOSITORY` (`owner/repo`) and uses
  `/repo/`.
- Override with `VITE_BASE_PATH` for custom domains (`/`) or renamed repos.

### Why refreshing never 404s

The app uses **hash-based routing**, so every internal URL is under
`#/…` (e.g. `#/dashboard`). GitHub Pages only ever serves `index.html`, and the
router reads the hash client-side. The workflow also copies `index.html` to
`404.html` as an extra safety net.

---

## 6. How it works

### Core concepts

- **Game template** — a reusable set of rounds, questions, options and an
  optional tiebreaker.
- **Game session** — one playthrough of a template. Starting the same game again
  creates a **new** session; previous results are never overwritten.
- **Team** — a participant in one session.
- **Tiebreaker** — a numeric closest-answer question, used only when two or more
  teams share first place after the normal questions.

### Scoring & reliability

Scoring, ranking and tiebreaker maths are **pure functions** in
`src/domain/` (`scoring.ts`, `ranking.ts`, `tiebreaker.ts`), covered by unit
tests in `src/domain/__tests__/`.

- Points are computed at reveal time and **persisted** per `(session, question,
  team)` with a unique constraint. Totals are summed from stored
  `awarded_points`, so reloading or revealing again **never double-counts**.
- Ties share a rank; team name is used only for stable visual ordering, never as
  a competition tiebreak.
- Refreshing the browser restores the active session and resumes the current
  question (state lives in the database / localStorage, not transient UI state).

### Routes

`#/login`, `#/dashboard`, `#/games/new`, `#/games/:id/edit`,
`#/games/:id/preview`, `#/games/:id/start`, `#/sessions/:id/setup`,
`#/sessions/:id/play`, `#/sessions/:id/scoreboard`, `#/sessions/:id/results`,
`#/public/:id`.

---

## 7. Data model

`profiles`, `games`, `rounds`, `questions`, `question_options`, `tiebreakers`,
`game_sessions`, `teams`, `team_answers`, `tiebreaker_answers`. See
`supabase/migrations/0001_schema.sql` for the authoritative definitions.

Every table exposed through the Data API has RLS enabled. Anonymous users can
read only a public session's scoreboard; the `correct_option_id` column is
withheld from the `anon` role so answers can never leak early.

---

## 8. Accessibility & responsiveness

Semantic HTML, labelled form controls, visible focus rings, keyboard-operable
controls, sufficient contrast, and status conveyed by text + icon (not colour
alone). Layouts are optimised for host laptops, projectors/TVs, tablets and
phones (two-column host screen collapses to a single column on small screens).
