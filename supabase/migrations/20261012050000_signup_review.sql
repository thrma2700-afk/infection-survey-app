-- 의료기관 회원가입과 관리자 승인 (PLAN 작업 5)
--   · 가입 때 입력한 기관명을 그대로 남겨, 관리자가 등록된 기관 정보와 비교해 승인할 수 있게 한다.
--   · 가입·승인·거절·교체 같은 계정 상태 변경은 모두 이력으로 남긴다. (보안 점검: 승인·권한 변경 기록 없음)
--   · 승인·거절·교체 승인은 한 번에(중간에 멈추지 않고) 처리하는 함수로 한다.

-- ============================================================
-- 가입 때 입력한 기관명
-- ============================================================
alter table public.profiles add column requested_institution_name text;
alter table public.profiles
  add constraint profiles_requested_name_len
  check (requested_institution_name is null or char_length(requested_institution_name) <= 100);

-- ============================================================
-- 계정 상태 변경 이력 (쌓기만 한다)
-- ============================================================
create table public.account_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null,                       -- 그 시점의 역할
  from_status public.approval_status,                   -- 처음 만들어질 때는 비어 있음
  to_status public.approval_status not null,
  performed_by uuid references public.profiles (id) on delete set null, -- 서버가 만든 계정(가입)은 비어 있음
  created_at timestamptz not null default now()
);

create index account_history_profile_idx on public.account_history (profile_id, created_at);

alter table public.account_history enable row level security;
revoke all on public.account_history from anon;
revoke insert, update, delete on public.account_history from authenticated;

create policy account_history_admin_select on public.account_history
  for select to authenticated
  using (public.app_user_role() = 'admin');

create function public.log_profile_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.account_history (profile_id, role, from_status, to_status, performed_by)
    values (new.id, new.role, null, new.approval_status, auth.uid());
  elsif new.approval_status is distinct from old.approval_status
        or new.role is distinct from old.role then
    insert into public.account_history (profile_id, role, from_status, to_status, performed_by)
    values (new.id, new.role, old.approval_status, new.approval_status, auth.uid());
  end if;
  return null;
end;
$$;

create trigger profiles_history after insert or update on public.profiles
  for each row execute function public.log_profile_status_change();

-- ============================================================
-- 가입 신청 처리 (관리자만)
--   approve : 승인. 같은 기관에 이미 승인된 담당자가 있으면 거부한다.
--   replace : 교체 승인. 같은 기관의 기존 승인 담당자를 거절 처리하고 이 신청을 승인한다.
--   reject  : 거절.
--   종별이 필요하면 p_institution_type으로 같이 지정한다. (관리자가 등록한 종별 목록에 있어야 한다)
--   호출한 사람의 권한으로 실행되므로(접근 규칙·상태 규칙이 그대로 적용된다) 관리자가 아니면 어떤 변경도 되지 않는다.
-- ============================================================
create function public.review_signup(
  p_profile uuid,
  p_decision text,
  p_institution_type text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  prof public.profiles%rowtype;
begin
  if public.app_user_role() is distinct from 'admin' then
    raise exception '관리자만 가입을 처리할 수 있습니다.';
  end if;

  if p_decision not in ('approve', 'reject', 'replace') then
    raise exception '알 수 없는 처리입니다.';
  end if;

  select * into prof
  from public.profiles
  where id = p_profile and role = 'institution'
  for update;

  if not found then
    raise exception '처리할 가입 신청을 찾을 수 없습니다.';
  end if;

  if p_decision = 'reject' then
    update public.profiles set approval_status = 'rejected' where id = prof.id;
    return;
  end if;

  if p_institution_type is not null and btrim(p_institution_type) <> '' then
    update public.institutions
    set institution_type = btrim(p_institution_type)
    where id = prof.institution_id;
  end if;

  if p_decision = 'replace' then
    update public.profiles
    set approval_status = 'rejected'
    where institution_id = prof.institution_id
      and approval_status = 'approved'
      and id <> prof.id;
  elsif exists (
    select 1 from public.profiles o
    where o.institution_id = prof.institution_id
      and o.approval_status = 'approved'
      and o.id <> prof.id
  ) then
    raise exception '이 기관에는 이미 승인된 담당자가 있습니다. 담당자를 바꾸려면 "교체 승인"을 사용하세요.';
  end if;

  update public.profiles set approval_status = 'approved' where id = prof.id;
end;
$$;

revoke execute on function public.review_signup(uuid, text, text) from public, anon;
grant execute on function public.review_signup(uuid, text, text) to authenticated;
