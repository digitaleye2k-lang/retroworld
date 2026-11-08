-- Run once in Supabase (SQL editor) to share ratings + reviews between all players.
create table if not exists rw_reviews(
  id bigint generated always as identity primary key,
  game text not null check (char_length(game) <= 80),
  device text not null check (char_length(device) <= 80),
  stars int not null check (stars between 1 and 5),
  name text not null default 'Player' check (char_length(name) <= 20),
  comment text not null default '' check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  unique (game, device)
);
alter table rw_reviews enable row level security;
create policy "anyone can read reviews" on rw_reviews for select using (true);
create policy "anyone can post a review" on rw_reviews for insert with check (true);
create policy "devices can update own review" on rw_reviews for update using (true) with check (stars between 1 and 5);
