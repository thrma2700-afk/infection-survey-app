-- 데이터 무결성 보강: 설계 대비 차이 점검(7~13번)
--   7)  추정치에 "전체 합계" 행이 들어가는 것을 막는다
--   8,9) 조사 자료의 반려·제출 기록을 임의로 바꾸지 못하게 하고, 반려 이력을 따로 쌓는다
--   10) 공개·철회·재공개 이력이 상태 변경과 함께 자동으로 남게 한다
--   11) 조사 자료·결과가 있는 회차와 조사 대상은 지울 수 없게 한다
--   13) 한 의료기관에는 승인된 담당자를 1명만 둔다
--   (12번 환자 정보 방지는 저장소에서 하지 않기로 했다. 화면 안내와 입력 검증에서 다룬다.)

-- ============================================================
-- 13. 기관당 승인된 담당자는 1명
--     (승인 대기 계정은 여러 명이어도 되고, 승인하는 시점에 막힌다. 담당자를 바꾸려면 기존 담당자를 먼저 거절 처리한다.)
-- ============================================================
create unique index profiles_one_approved_per_institution
  on public.profiles (institution_id)
  where role = 'institution' and approval_status = 'approved';

-- ============================================================
-- 7. 추정치의 기관 종별은 이 회차 조사 대상 기관의 종별이어야 한다
--    (전체 합계 행은 어떤 기관의 종별도 아니므로 만들 수 없다)
-- ============================================================
create function public.enforce_estimate_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.round_institutions ri
    join public.institutions i on i.id = ri.institution_id
    where ri.round_id = new.round_id
      and i.institution_type = new.institution_type
  ) then
    raise exception '추정치의 기관 종별 "%"은(는) 이 회차 조사 대상 기관의 종별에 없습니다. (전체 합계 행은 만들 수 없습니다)', new.institution_type;
  end if;
  return new;
end;
$$;

create trigger estimates_type_check before insert or update on public.estimates
  for each row execute function public.enforce_estimate_type();

-- 추정치 값 안에 합계를 뜻하는 이름의 항목을 넣을 수 없다
alter table public.estimates
  add constraint estimates_no_total_key
  check (not (estimate_values ?| array['total', 'Total', 'TOTAL', '합계', '전체', '총계']));

-- ============================================================
-- 8, 9. 조사 자료의 반려·제출 기록
-- ============================================================

-- 반려·제출 이력 (쌓기만 하고 고치거나 지우지 못한다. 반려 사유가 덮어써져도 이전 반려가 남는다)
create table public.submission_history (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions (id),
  event text not null check (event in ('submitted', 'returned')),
  reason text,
  performed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.submission_history enable row level security;
revoke all on public.submission_history from anon;
revoke insert, update, delete on public.submission_history from authenticated;

create policy submission_history_admin_select on public.submission_history
  for select to authenticated
  using (public.app_user_role() = 'admin');

-- 새로 만드는 자료에는 제출·반려 기록을 넣을 수 없다 (서버 관리 키는 예외)
create function public.enforce_submission_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.submitted_at := null;
    new.returned_at := null;
    new.return_reason := null;
  end if;
  return new;
end;
$$;

create trigger submissions_insert_rules before insert on public.submissions
  for each row execute function public.enforce_submission_insert();

-- 조사 자료 수정 규칙 교체: 반려·제출 기록은 정해진 상태 변경 때만 바뀐다
create or replace function public.enforce_submission_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor public.user_role;
begin
  -- 자료를 다른 회차·기관으로 옮겨 입력 기간·배정 규칙을 우회하지 못하게 한다 (서버 관리 키도 같다)
  if new.id is distinct from old.id
     or new.round_id is distinct from old.round_id
     or new.institution_id is distinct from old.institution_id then
    raise exception '조사 자료의 회차와 기관은 바꿀 수 없습니다.';
  end if;

  -- 공개 중인 결과의 바탕 자료가 바뀌지 않게 한다 (서버 관리 키도 같다)
  if public.app_round_published(old.round_id) then
    raise exception '공개 중인 회차의 조사 자료는 수정할 수 없습니다. 먼저 공개를 철회하세요.';
  end if;

  if auth.uid() is null then
    return new;
  end if;

  actor := public.app_user_role();

  if actor = 'admin' then
    if new.answers is distinct from old.answers
       or new.out_of_range_notes is distinct from old.out_of_range_notes then
      raise exception '관리자는 조사 자료의 내용을 직접 고칠 수 없습니다.';
    end if;
    if new.submitted_at is distinct from old.submitted_at then
      raise exception '제출 일시는 바꿀 수 없습니다.';
    end if;
    if new.status is distinct from old.status then
      if not (old.status = 'submitted' and new.status = 'returned') then
        raise exception '관리자는 제출된 자료를 반려하는 상태 변경만 할 수 있습니다.';
      end if;
      if length(btrim(coalesce(new.return_reason, ''))) = 0 then
        raise exception '반려할 때는 사유를 반드시 적어야 합니다.';
      end if;
      new.returned_at := now();
    elsif new.return_reason is distinct from old.return_reason
          or new.returned_at is distinct from old.returned_at then
      raise exception '반려 기록은 반려할 때만 남길 수 있고, 고칠 수 없습니다.';
    end if;
    return new;
  end if;

  if actor = 'surveyor' then
    if old.status = 'submitted' then
      raise exception '제출된 자료는 수정할 수 없습니다. 관리자가 반려해야 다시 수정할 수 있습니다.';
    end if;
    if new.status = 'returned' and old.status <> 'returned' then
      raise exception '조사관은 자료를 반려할 수 없습니다.';
    end if;
    if new.return_reason is distinct from old.return_reason
       or new.returned_at is distinct from old.returned_at then
      raise exception '반려 기록은 조사관이 바꿀 수 없습니다.';
    end if;
    if new.status = 'submitted' then
      new.submitted_at := now();
    elsif new.submitted_at is distinct from old.submitted_at then
      raise exception '제출 일시는 바꿀 수 없습니다.';
    end if;
    return new;
  end if;

  raise exception '이 자료를 수정할 권한이 없습니다.';
end;
$$;

-- 제출·반려가 일어나면 이력을 쌓는다
create function public.log_submission_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'submitted' then
      insert into public.submission_history (submission_id, event, performed_by)
      values (new.id, 'submitted', auth.uid());
    elsif new.status = 'returned' then
      insert into public.submission_history (submission_id, event, reason, performed_by)
      values (new.id, 'returned', new.return_reason, auth.uid());
    end if;
  end if;
  return null;
end;
$$;

create trigger submissions_history after update on public.submissions
  for each row execute function public.log_submission_event();

-- ============================================================
-- 10. 공개·철회·재공개 이력이 상태 변경과 함께 자동으로 남는다
--     · 철회와 재공개는 사유(status_reason)를 같은 수정 안에서 적어야 한다
--     · 수행한 관리자는 로그인한 사용자로 자동 기록된다 (서버 관리 키를 쓸 때는 published_by / withdrawn_by에 직접 적는다)
--     · 일시도 자동으로 채워진다
-- ============================================================
alter table public.round_results
  add column status_reason text,
  add column withdrawn_by uuid references public.profiles (id);

alter table public.publish_log alter column performed_by set not null;

-- 이력은 상태 변경 규칙(아래 함수)만 쓴다. 사람이 직접 넣을 수 없다.
drop policy publish_log_admin_insert on public.publish_log;
revoke insert on public.publish_log from authenticated;

create or replace function public.enforce_result_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  had_published boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if not ((old.status, new.status) in (
    ('calculated', 'verified'),
    ('verified', 'published'),
    ('published', 'withdrawn'),
    ('withdrawn', 'calculated'),
    ('verified', 'calculated')
  )) then
    raise exception '결과 상태를 % 에서 % 로 바꿀 수 없습니다. (검증 완료 전에는 공개할 수 없습니다)', old.status, new.status;
  end if;

  if new.status = 'verified' then
    new.verified_at := now();
    new.verified_by := coalesce(auth.uid(), new.verified_by);

  elsif new.status = 'calculated' then
    new.calculated_at := now();
    new.verified_at := null;
    new.verified_by := null;

  elsif new.status = 'published' then
    actor := coalesce(auth.uid(), new.published_by);
    if actor is null then
      raise exception '공개를 수행한 관리자를 알 수 없습니다.';
    end if;

    select exists (
      select 1 from public.publish_log l
      where l.round_id = new.round_id and l.action in ('publish', 'republish')
    ) into had_published;

    if had_published and length(btrim(coalesce(new.status_reason, ''))) = 0 then
      raise exception '재공개할 때는 사유를 반드시 적어야 합니다.';
    end if;

    new.published_at := now();
    new.published_by := actor;
    new.withdrawn_at := null;
    new.withdrawn_by := null;

    insert into public.publish_log (round_id, action, reason, change_summary, performed_by)
    values (
      new.round_id,
      (case when had_published then 'republish' else 'publish' end)::public.publish_action,
      nullif(btrim(coalesce(new.status_reason, '')), ''),
      case when had_published then '재산출·재검증 후 재공개' else '결과 공개' end,
      actor
    );
    new.status_reason := null;

  elsif new.status = 'withdrawn' then
    actor := coalesce(auth.uid(), new.withdrawn_by);
    if actor is null then
      raise exception '철회를 수행한 관리자를 알 수 없습니다.';
    end if;
    if length(btrim(coalesce(new.status_reason, ''))) = 0 then
      raise exception '공개를 철회할 때는 사유를 반드시 적어야 합니다.';
    end if;

    new.withdrawn_at := now();
    new.withdrawn_by := actor;

    insert into public.publish_log (round_id, action, reason, change_summary, performed_by)
    values (new.round_id, 'withdraw', btrim(new.status_reason), '공개 철회', actor);
    new.status_reason := null;
  end if;

  return new;
end;
$$;

-- ============================================================
-- 11. 조사 자료·결과가 있는 회차와 조사 대상은 지울 수 없다
--     (지우면 조사 자료·코멘트·결과가 함께 사라지는 것을 막는다. 배정을 바꾸는 것은 surveyor_id를 고치면 된다)
-- ============================================================
create function public.block_round_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.submissions s where s.round_id = old.id)
     or exists (select 1 from public.round_results r where r.round_id = old.id)
     or exists (select 1 from public.comments c where c.round_id = old.id) then
    raise exception '조사 자료나 산출 결과, 코멘트가 있는 회차는 지울 수 없습니다.';
  end if;
  return old;
end;
$$;

create trigger rounds_block_delete before delete on public.rounds
  for each row execute function public.block_round_delete();

create function public.block_round_institution_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
       select 1 from public.submissions s
       where s.round_id = old.round_id and s.institution_id = old.institution_id
     )
     or exists (
       select 1 from public.comments c
       where c.round_id = old.round_id and c.institution_id = old.institution_id
     )
     or exists (
       select 1 from public.institution_indicators i
       where i.round_id = old.round_id and i.institution_id = old.institution_id
     ) then
    raise exception '조사 자료나 코멘트, 지표가 있는 조사 대상은 뺄 수 없습니다.';
  end if;
  return old;
end;
$$;

create trigger round_institutions_block_delete before delete on public.round_institutions
  for each row execute function public.block_round_institution_delete();
