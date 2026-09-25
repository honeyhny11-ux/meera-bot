-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists notes (
  id                 bigint generated always as identity primary key,
  created_at         timestamptz not null default now(),
  telegram_update_id bigint unique,          -- stops Telegram retries creating duplicates
  chat_id            bigint not null,
  text               text not null,
  score              int,
  score_reason       text,
  status             text not null default 'received'  -- received | rejected | drafted | error
);

create table if not exists drafts (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  note_id             bigint references notes(id),
  chat_id             bigint not null,
  telegram_message_id bigint,                -- the draft message, so a reply maps back to it
  content             text not null,
  news                jsonb,                 -- {headline, source, date, link, summary} if used
  search_query        text,
  model               text,
  status              text not null default 'pending',  -- pending | approved | rejected
  feedback            text,
  decided_at          timestamptz
);

create table if not exists voice_skill (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  content    text not null,
  active     boolean not null default true
);

-- Rejected notes and drafts are never deleted: they show what needs improving.

-- Lock the tables to the server. The bot uses the service/secret key, which bypasses RLS;
-- the public anon key gets no access.
alter table notes       enable row level security;
alter table drafts      enable row level security;
alter table voice_skill enable row level security;
