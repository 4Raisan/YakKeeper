-- Keep only the repository ID when a moderated listing is deleted.
create table public.yak_repo_restrictions (
 id uuid primary key default gen_random_uuid(),
 repo_id bigint not null unique,
 created_at timestamptz not null default now()
);
alter table public.yak_repo_restrictions enable row level security;
revoke all on public.yak_repo_restrictions from public,anon,authenticated;
grant all on public.yak_repo_restrictions to service_role;
create function public.yak_preserve_repo_moderation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' then
  if OLD.moderated and OLD.repo_id is not null then
   insert into public.yak_repo_restrictions(repo_id) values(OLD.repo_id) on conflict(repo_id) do nothing;
  end if;
  return OLD;
 end if;
 if exists(select 1 from public.yak_repo_restrictions where repo_id=NEW.repo_id) then
  raise exception using errcode='42501',message='This repository was restricted by a moderator.';
 end if;
 return NEW;
end; $$;
revoke all on function public.yak_preserve_repo_moderation() from public,anon,authenticated;
grant execute on function public.yak_preserve_repo_moderation() to service_role;
create trigger yak_preserve_deleted_moderation before delete on public.yak_projects for each row execute function public.yak_preserve_repo_moderation();
create trigger yak_block_restricted_repo before insert on public.yak_projects for each row execute function public.yak_preserve_repo_moderation();
