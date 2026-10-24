alter table public.yak_tasks add column archived boolean not null default false;
create index yak_tasks_active on public.yak_tasks(project_id,archived,created_at desc);
-- Serialize capacity checks per project, including concurrent restores.
create function public.yak_task_capacity() returns trigger
language plpgsql set search_path='' as $$
begin
  if not new.archived then
    perform 1 from public.yak_projects where id=new.project_id for update;
    if (select count(*) from public.yak_tasks where project_id=new.project_id and not archived and id<>new.id)>=200 then
      raise exception 'A board supports up to 200 active tasks. Archive a task first.' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.yak_task_capacity() from public,anon,authenticated;
create trigger yak_task_active_capacity before insert or update of archived on public.yak_tasks
for each row execute function public.yak_task_capacity();
