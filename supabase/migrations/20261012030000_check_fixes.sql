-- 점검(CHECK.md) 후속 보완
--   Gap 5 (의료기관에 관리자 id 비노출): 의료기관은 표를 직접 읽지 않고, 필요한 칸만 담은 뷰로만 읽는다
--   Gap 8 (승인 기본값): 관리자가 발급하는 조사관·관리자 계정은 승인 상태로 시작한다
--   Gap 9 (기관 종별): 종별은 관리자만 입력하고, 종별이 있어야 의료기관 가입을 승인할 수 있다
--   Gap 14 (조사관이 모든 회차 목록을 봄): 조사관은 배정된 회차만 본다
--   Gap 15 (일시 정리): 오픈·마감 일시를 자동으로 기록한다
--   기준 5 (운영 후 측정): 공표·분석 기간, 참여율, 피드백 제공률을 계산하는 관리자용 뷰

-- ============================================================
-- 기관 종별: 관리자가 관리하는 목록 (표기가 달라 구간이 갈리는 것을 막는다)
-- ============================================================
create table public.institution_types (
  name text primary key,
  created_at timestamptz not null default now()
);

alter table public.institution_types enable row level security;
revoke all on public.institution_types from anon;

create policy institution_types_admin_all on public.institution_types
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');

-- 기관의 종별은 이 목록에 있는 값만 쓸 수 있다 (기관 표는 관리자만 고칠 수 있다)
alter table public.institutions
  add constraint institutions_type_fk
  foreign key (institution_type) references public.institution_types (name)
  on update cascade;

-- ============================================================
-- 사용자: 승인 기본값과 종별 승인 조건
-- ============================================================
create function public.enforce_profile_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 관리자가 발급하는 조사관·관리자 계정은 바로 승인 상태로 시작한다
  if tg_op = 'INSERT' and new.role in ('surveyor', 'admin') then
    new.approval_status := 'approved';
  end if;

  -- 의료기관 담당자는 기관 종별이 지정되어 있어야 승인할 수 있다
  if new.role = 'institution'
     and new.approval_status = 'approved'
     and (tg_op = 'INSERT' or old.approval_status is distinct from 'approved') then
    if not exists (
      select 1 from public.institutions i
      where i.id = new.institution_id and i.institution_type is not null
    ) then
      raise exception '기관 종별을 먼저 지정해야 의료기관 가입을 승인할 수 있습니다.';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_rules before insert or update on public.profiles
  for each row execute function public.enforce_profile_rules();

-- ============================================================
-- 회차: 조사관은 배정된 회차만 보고, 오픈·마감 일시는 자동으로 기록한다
-- ============================================================
drop policy rounds_surveyor_select on public.rounds;
create policy rounds_surveyor_select on public.rounds
  for select to authenticated
  using (
    public.app_user_role() = 'surveyor'
    and exists (
      select 1 from public.round_institutions ri
      where ri.round_id = rounds.id and ri.surveyor_id = auth.uid()
    )
  );

create function public.set_round_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_open then
      new.opened_at := now();
    end if;
    return new;
  end if;

  if new.is_open and not old.is_open then
    new.opened_at := now();
    new.closed_at := null;
  elsif not new.is_open and old.is_open then
    new.closed_at := now();
  end if;
  return new;
end;
$$;

create trigger rounds_timestamps before insert or update on public.rounds
  for each row execute function public.set_round_timestamps();

-- ============================================================
-- 의료기관에는 관리자 id 같은 내부 정보가 보이지 않게 한다
--   표(round_results, comments)를 직접 읽는 권한을 없애고, 필요한 칸만 담은 뷰로만 읽게 한다.
--   뷰는 만든 사람 권한으로 실행되므로, 뷰 안에서 역할·기관·공개 여부를 직접 검사한다.
-- ============================================================
drop policy round_results_institution_select_published on public.round_results;
drop policy comments_institution_select_own on public.comments;

create view public.institution_round_results as
  select r.round_id, r.status, r.published_at
  from public.round_results r
  where public.app_user_role() = 'institution'
    and r.status = 'published';

create view public.institution_comments as
  select c.round_id, c.institution_id, c.body, c.updated_at
  from public.comments c
  where public.app_user_role() = 'institution'
    and c.institution_id = public.app_institution_id()
    and public.app_round_published(c.round_id);

revoke all on public.institution_round_results from anon;
revoke all on public.institution_comments from anon;
grant select on public.institution_round_results to authenticated;
grant select on public.institution_comments to authenticated;

-- ============================================================
-- 운영 후 측정: 서비스 목표(공표 3개월, 분석 1개월, 피드백 100%, 참여율)를 계산한다 (관리자만)
--   공표까지 기간 = 조사 마감 → 첫 공개
--   분석 기간     = 조사 마감 → 검증 완료
--   참여율        = 제출된 기관 수 ÷ 전체 의료기관 수(심평원 통계자료 값)
--   피드백 제공률 = 기관별 지표가 공개된 기관 수 ÷ 제출된 기관 수
-- ============================================================
create view public.round_metrics
with (security_invoker = true) as
  select
    r.id as round_id,
    r.name as round_name,
    r.closed_at as survey_closed_at,
    first_pub.first_published_at,
    rr.verified_at,
    case when first_pub.first_published_at is not null and r.closed_at is not null
      then round((extract(epoch from (first_pub.first_published_at - r.closed_at)) / 86400)::numeric, 1)
    end as days_to_publish,
    case when rr.verified_at is not null and r.closed_at is not null
      then round((extract(epoch from (rr.verified_at - r.closed_at)) / 86400)::numeric, 1)
    end as days_to_verify,
    sub.submitted_count,
    rs.total_institution_count,
    case when coalesce(rs.total_institution_count, 0) > 0
      then round(100.0 * sub.submitted_count / rs.total_institution_count, 1)
    end as participation_rate_pct,
    case when rr.status = 'published' and sub.submitted_count > 0
      then round(100.0 * ind.indicator_count / sub.submitted_count, 1)
    end as feedback_rate_pct
  from public.rounds r
  left join public.round_results rr on rr.round_id = r.id
  left join public.reference_stats rs on rs.round_id = r.id
  left join lateral (
    select min(l.created_at) as first_published_at
    from public.publish_log l
    where l.round_id = r.id and l.action = 'publish'
  ) first_pub on true
  left join lateral (
    select count(*)::integer as submitted_count
    from public.submissions s
    where s.round_id = r.id and s.status = 'submitted'
  ) sub on true
  left join lateral (
    select count(*)::integer as indicator_count
    from public.institution_indicators i
    where i.round_id = r.id
  ) ind on true
  where public.app_user_role() = 'admin';

revoke all on public.round_metrics from anon;
grant select on public.round_metrics to authenticated;
