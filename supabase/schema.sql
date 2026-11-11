-- Apunt · base de dades a Supabase (regió UE). Tot el que s'hi guarda està xifrat al dispositiu.
-- Per muntar un projecte nou: SQL Editor → enganxa aquest fitxer → Run.
-- A més: Authentication → Email → desactivar «Confirm email»; i a Vercel, la variable SUPABASE_SECRET_KEY.

create table if not exists public.keyrings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  keyring jsonb not null,                -- clau de dades embolicada (contrasenya i codi de recuperació)
  recovery_verifier text,                -- SHA-256 de la prova de recuperació (no permet fer la prova)
  updated_at timestamptz not null default now()
);
create table if not exists public.items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  sealed text not null default '',       -- registre xifrat (XChaCha20-Poly1305)
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists items_user_updated on public.items (user_id, updated_at);

alter table public.keyrings enable row level security;
alter table public.items enable row level security;
create policy "own keyring" on public.keyrings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own items" on public.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = clock_timestamp(); return new; end $$;
create trigger items_touch before insert or update on public.items for each row execute function public.touch();
create trigger keyrings_touch before insert or update on public.keyrings for each row execute function public.touch();

-- Cada usuari, només les seves files (RLS). La funció de recuperació (clau secreta, només a Vercel)
-- pot llegir i actualitzar els clauers.
grant select, insert, update, delete on public.items, public.keyrings to authenticated;
grant select, update on public.keyrings to service_role;

-- «He oblidat la contrasenya»: de correu a usuari. Només la pot fer servir el servidor.
create or replace function public.user_id_by_email(p_email text) returns uuid
language sql security definer set search_path = '' as $$
  select id from auth.users where email = lower(trim(p_email)) limit 1
$$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
