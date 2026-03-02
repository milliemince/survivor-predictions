# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```

**Supabase local dev:**
```bash
supabase start   # Start local Supabase stack (API :54321, DB :54322, Studio :54323)
supabase stop
supabase db reset  # Reset DB and re-run migrations + seed.sql
```

No test framework is set up.

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Supabase (auth + PostgreSQL), Tailwind CSS v4

**Route structure:**
- `app/(app)/` — authenticated route group; `layout.tsx` fetches user profile and renders NavBar
- `app/login/`, `app/signup/` — public auth pages
- `middleware.ts` — protects `/dashboard`, `/predictions`, `/admin`, `/leaderboard`; redirects to `/login`

**Server vs Client split:**
- `page.tsx` files are Server Components — fetch data, check auth, pass props down
- Interactive files (e.g. `PredictionsForm.tsx`, `AdminPanel.tsx`, `PlayerSelector.tsx`, `NavBar.tsx`) are Client Components (`"use client"`)
- Server components pass data as props to client components at the boundary

**Supabase client pattern:**
- `lib/supabaseClient.ts` — browser singleton used in client components
- `lib/supabaseServer.ts` — async `createClient()` factory used in server components and middleware

**Admin access:** Checked via `profiles.is_admin = true`. Server components redirect non-admins; RLS enforces DB-level access.

## Database

Migrations live in `supabase/migrations/`. Schema:
- `profiles` — auto-created on signup via trigger; has `username`, `is_admin`
- `episodes` — admin-managed
- `questions` — per-episode; has `lock_time` (timestamp after which predictions are immutable) and `correct_answer`
- `predictions` — unique on `(user_id, question_id)`; `predicted_answer` stores player name as plain string
- `leaderboard` — SQL VIEW; auto-recalculates on scoring

**Scoring:** Call RPC `score_question(question_id)` after setting `questions.correct_answer`. Does case-insensitive, trimmed string comparison against `predicted_answer`.

## Predictions & Player Selector

`app/(app)/predictions/players.ts` — `SEASON_50_PLAYERS` array; player images hosted in Supabase storage at `player-photos/` bucket.

Elimination questions are auto-detected by keywords (`"eliminat"`, `"voted out"`, `"going home"`, `"who is leaving"`) in `isEliminationQuestion()`. These render a `PlayerSelector` grid instead of a text input. `predicted_answer` is saved as the player's `name` string.

## Design Conventions

- **Primary color:** `orange-600` / `orange-700` / `orange-50` — buttons, active nav states
- **Cards:** `rounded-xl border border-black/10 bg-white`
- **Buttons:** `rounded-full bg-orange-600 text-white`
- Tailwind v4: no config file — uses `@import "tailwindcss"` in `app/globals.css`
- No component library — all UI is inline Tailwind
