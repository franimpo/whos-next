-- WHO'S NEXT — COMPLETE DATABASE SCHEMA
-- Run in Supabase -> SQL Editor on a fresh project.
-- If you already have the original tables, this script is safe to re-run for the
-- additive fields/indexes used by the current version.

create table if not exists people (
  id bigint generated always as identity primary key,
  wikidata_id text not null unique,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists rounds (
  id bigint generated always as identity primary key,
  title text,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  recipient_person_id bigint references people(id),
  death_date date
);

-- Adds death_date when upgrading an older database.
alter table rounds
  add column if not exists death_date date;

create table if not exists votes (
  id bigint generated always as identity primary key,
  round_id bigint not null references rounds(id) on delete cascade,
  person_id bigint not null references people(id) on delete cascade,
  voter_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists votes_round_id_idx on votes(round_id);
create index if not exists votes_person_id_idx on votes(person_id);
create index if not exists votes_round_person_idx on votes(round_id, person_id);
create index if not exists rounds_death_date_idx
  on rounds (death_date desc)
  where status = 'closed';

-- One anonymous browser can have one active prediction per round.
-- Casting another prediction updates that browser's existing vote.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'votes_round_voter_unique'
  ) then
    alter table votes
      add constraint votes_round_voter_unique unique (round_id, voter_hash);
  end if;
end $$;

-- The public browser never talks directly to these tables. The application uses
-- the server-only Supabase Secret Key from Next.js route handlers.
alter table people enable row level security;
alter table rounds enable row level security;
alter table votes enable row level security;

-- Create an initial active round only when there isn't one already.
insert into rounds (title, status)
select 'Round 1', 'active'
where not exists (select 1 from rounds where status = 'active');
