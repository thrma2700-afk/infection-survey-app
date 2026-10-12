-- 상태 규칙 보강: 설계 대비 차이 점검(1~4번)에서 나온 빈틈을 막는다
--   1) 조사관이 자료의 회차·기관을 바꿔 입력 기간 규칙을 우회하는 것
--   2) 공개 중인 회차의 자료가 바뀌거나, 제출되지 않은 값이 의료기관에 보이는 것
--   3) 검증 완료 전에 결과를 처음부터 "공개" 상태로 만들거나, 공개 중인 결과를 지우는 것
--   4) 자료가 바뀌었는데 결과 상태가 "산출됨"으로 되돌아가지 않는 것

-- ============================================================
-- 1, 2. 조사 자료 규칙 교체
--    · 자료의 id·회차·기관은 누구도 바꿀 수 없다
--    · 공개 중인 회차의 자료는 누구도 고칠 수 없다 (먼저 공개를 철회해야 한다)
-- ============================================================
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
    if new.status is distinct from old.status then
      if not (old.status = 'submitted' and new.status = 'returned') then
        raise exception '관리자는 제출된 자료를 반려하는 상태 변경만 할 수 있습니다.';
      end if;
      if length(btrim(coalesce(new.return_reason, ''))) = 0 then
        raise exception '반려할 때는 사유를 반드시 적어야 합니다.';
      end if;
      new.returned_at := now();
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
    if new.status = 'submitted' then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  raise exception '이 자료를 수정할 권한이 없습니다.';
end;
$$;

-- 의료기관에는 "제출된" 자료만 보인다 (수정 중인 값, 반려된 값, 임시저장 값은 보이지 않는다)
drop policy submissions_institution_select_published on public.submissions;
create policy submissions_institution_select_published on public.submissions
  for select to authenticated
  using (
    public.app_user_role() = 'institution'
    and institution_id = public.app_institution_id()
    and status = 'submitted'
    and public.app_round_published(round_id)
  );

-- ============================================================
-- 3. 결과 상태: 새로 만들 때는 "산출됨"만, 공개 중인 결과는 지울 수 없다
-- ============================================================
create function public.enforce_result_insert_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'calculated' then
      raise exception '새 결과는 "산출됨" 상태로만 만들 수 있습니다. (검증 완료 전에는 공개할 수 없습니다)';
    end if;
    return new;
  end if;

  if old.status = 'published' then
    raise exception '공개 중인 결과는 지울 수 없습니다. 먼저 공개를 철회하세요.';
  end if;
  return old;
end;
$$;

create trigger round_results_insert_delete before insert or delete on public.round_results
  for each row execute function public.enforce_result_insert_delete();

-- ============================================================
-- 4. 자료가 바뀌면 결과 상태가 "산출됨"으로 돌아간다
-- ============================================================

-- 추정치·기관별 지표를 넣거나 고치거나 지울 때
--   · 공개 중이면 막는다 (먼저 공개를 철회해야 한다)
--   · 검증 완료·철회됨 상태이면 "산출됨"으로 되돌려, 다시 검증을 거치게 한다
create function public.guard_result_data_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_round uuid;
  current_status public.result_status;
begin
  target_round := coalesce(new.round_id, old.round_id);

  select r.status into current_status
  from public.round_results r
  where r.round_id = target_round;

  if current_status = 'published' then
    raise exception '공개 중인 결과의 추정치·지표는 바꿀 수 없습니다. 먼저 공개를 철회하세요.';
  elsif current_status in ('verified', 'withdrawn') then
    update public.round_results
    set status = 'calculated', calculated_at = now(), verified_at = null, verified_by = null
    where round_id = target_round;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger estimates_guard before insert or update or delete on public.estimates
  for each row execute function public.guard_result_data_change();
create trigger institution_indicators_guard before insert or update or delete on public.institution_indicators
  for each row execute function public.guard_result_data_change();

-- 조사 자료가 바뀌면(예: 검증 중에 반려·재제출) 이미 검증 완료된 결과를 "산출됨"으로 되돌린다
create function public.revert_verified_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.round_results
  set status = 'calculated', calculated_at = now(), verified_at = null, verified_by = null
  where round_id = new.round_id and status = 'verified';
  return null;
end;
$$;

create trigger submissions_revert_verified after update on public.submissions
  for each row execute function public.revert_verified_result();
