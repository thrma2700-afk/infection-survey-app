-- 감염관리 실태조사 관리 시스템: 초기 데이터 구조
-- 기준: DESIGN.md 4장(데이터 구조), 5장(권한과 보안 설계, 3단계 저장소 규칙), PRD.md
--
-- 이 파일이 하는 일
--   1) 표(테이블)와 상태 값을 만든다.
--   2) 모든 표에 행 단위 접근 규칙(RLS)을 켜고, 역할별 규칙을 둔다.
--   3) 상태가 잘못 바뀌지 않도록 막는 규칙(트리거)을 둔다.

-- ============================================================
-- 1. 상태 값
-- ============================================================

create type public.user_role as enum ('surveyor', 'admin', 'institution'); -- 조사관, 관리자, 의료기관
create type public.approval_status as enum ('pending', 'approved', 'rejected'); -- 대기, 승인, 거절
create type public.submission_status as enum ('draft', 'submitted', 'returned'); -- 임시저장, 제출, 반려
create type public.result_status as enum ('calculated', 'verified', 'published', 'withdrawn'); -- 산출됨, 검증 완료, 공개, 철회됨
create type public.publish_action as enum ('publish', 'withdraw', 'republish'); -- 공개, 철회, 재공개

-- ============================================================
-- 2. 표
-- ============================================================

-- 의료기관
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ykiho_code text not null unique, -- 요양기관번호 (중복 불가)
  institution_type text,           -- 기관 종별(상급종합, 종합병원 등). 가입 때 자동 생성되면 비어 있고, 관리자가 채운다
  created_at timestamptz not null default now()
);

-- 사용자 (로그인 계정은 Supabase 로그인 시스템이 관리하고, 이 표는 역할과 승인 상태를 담는다)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null,
  institution_id uuid references public.institutions (id), -- 의료기관 역할만 소속 기관이 있다
  approval_status public.approval_status not null default 'pending',
  created_at timestamptz not null default now(),
  -- 의료기관 역할은 소속 기관이 반드시 있고, 조사관·관리자는 없어야 한다
  constraint profiles_institution_matches_role
    check ((role = 'institution') = (institution_id is not null))
);

-- 조사 회차
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null,
  is_open boolean not null default false, -- 입력 가능 여부는 이 값(오픈·마감 버튼)으로만 판단한다
  opened_at timestamptz,                  -- 오픈·마감 일시는 기록용이다
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 한 번에 하나의 회차만 오픈할 수 있다
create unique index rounds_only_one_open on public.rounds ((is_open)) where is_open;

-- 회차별 조사 대상 의료기관과 담당 조사관
-- (조사 대상이지만 아직 조사관이 배정되지 않은 기관은 surveyor_id가 비어 있다)
create table public.round_institutions (
  round_id uuid not null references public.rounds (id) on delete cascade,
  institution_id uuid not null references public.institutions (id),
  surveyor_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (round_id, institution_id)
);

create index round_institutions_surveyor_idx on public.round_institutions (surveyor_id);

-- 조사 자료 (기관별, 회차별 1건)
-- 조사표 항목이 아직 정해지지 않아, 항목별 입력값을 항목 이름과 값으로 묶어 저장한다
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null,
  institution_id uuid not null,
  status public.submission_status not null default 'draft',
  answers jsonb not null default '{}'::jsonb,            -- 항목별 입력값
  out_of_range_notes jsonb not null default '{}'::jsonb, -- 허용 범위를 벗어난 항목의 사유
  return_reason text,                                    -- 반려 사유
  submitted_at timestamptz,
  returned_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (round_id, institution_id),
  foreign key (round_id, institution_id)
    references public.round_institutions (round_id, institution_id) on delete cascade
);

-- 산출 결과의 상태 (회차 단위로 관리한다)
create table public.round_results (
  round_id uuid primary key references public.rounds (id) on delete cascade,
  status public.result_status not null default 'calculated',
  calculated_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  published_at timestamptz,
  published_by uuid references public.profiles (id),
  withdrawn_at timestamptz
);

-- 기관 종별 추정치 (전체 합계 행은 만들지 않는다: 합계에서 숨긴 구간을 역산하지 못하게 하기 위해)
create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.round_results (round_id) on delete cascade,
  institution_type text not null,
  sample_count integer not null check (sample_count >= 0), -- 표본 수
  estimate_values jsonb not null,                          -- 추정치
  method_note text not null,                               -- 산출 기준
  unique (round_id, institution_type)
);

-- 기관별 지표
create table public.institution_indicators (
  round_id uuid not null references public.round_results (round_id) on delete cascade,
  institution_id uuid not null references public.institutions (id),
  indicator_values jsonb not null,
  primary key (round_id, institution_id)
);

-- 기관별 코멘트
create table public.comments (
  round_id uuid not null,
  institution_id uuid not null,
  body text not null,
  author_id uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (round_id, institution_id),
  foreign key (round_id, institution_id)
    references public.round_institutions (round_id, institution_id) on delete cascade
);

-- 공개·철회·재공개 변경 이력 (지우거나 고치지 않고 계속 쌓는다)
create table public.publish_log (
  id bigint generated always as identity primary key,
  round_id uuid not null references public.rounds (id),
  action public.publish_action not null,
  reason text,
  change_summary text,
  performed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  -- 철회와 재공개는 사유를 반드시 적는다
  constraint publish_log_reason_required
    check (action = 'publish' or length(btrim(coalesce(reason, ''))) > 0)
);

-- 기준 통계 (참여율의 분모: 전체 의료기관 수, 심평원 통계자료 값)
create table public.reference_stats (
  round_id uuid primary key references public.rounds (id) on delete cascade,
  total_institution_count integer not null check (total_institution_count >= 0),
  source text not null default '심평원 통계자료',
  updated_at timestamptz not null default now()
);

-- 바꿀 수 있는 설정 값 (기준 수치를 한곳에서 관리한다)
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- 응답 기관이 이 수보다 적은 구간의 통계는 의료기관에 보여 주지 않는다 (PRD: 5곳 미만 숨김)
insert into public.app_settings (key, value) values ('min_group_size', '5'::jsonb);

-- ============================================================
-- 3. 도우미 함수 (접근 규칙에서 쓴다)
-- ============================================================

-- 지금 로그인한 사용자의 역할. 승인되지 않은 계정은 역할이 없는 것으로 본다.
create function public.app_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.approval_status = 'approved'
$$;

-- 지금 로그인한 사용자(승인된 의료기관 담당자)의 소속 기관
create function public.app_institution_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.institution_id
  from public.profiles p
  where p.id = auth.uid() and p.approval_status = 'approved'
$$;

-- 해당 회차의 결과가 공개 상태인가
create function public.app_round_published(target_round uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.round_results r
    where r.round_id = target_round and r.status = 'published'
  )
$$;

-- 해당 회차가 지금 입력 가능(오픈) 상태인가
create function public.app_round_is_open(target_round uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rounds r
    where r.id = target_round and r.is_open
  )
$$;

-- 지금 로그인한 조사관이 해당 회차·기관에 배정되어 있는가
create function public.app_surveyor_assigned(target_round uuid, target_institution uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.round_institutions ri
    where ri.round_id = target_round
      and ri.institution_id = target_institution
      and ri.surveyor_id = auth.uid()
  ) and public.app_user_role() = 'surveyor'
$$;

-- 통계 숨김 기준 (기본 5곳)
create function public.app_min_group_size()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::integer from public.app_settings s where s.key = 'min_group_size'), 5)
$$;

-- ============================================================
-- 4. 상태가 잘못 바뀌지 않게 막는 규칙 (트리거)
-- ============================================================

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger submissions_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();
create trigger reference_stats_updated_at before update on public.reference_stats
  for each row execute function public.set_updated_at();
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- 조사 자료의 상태 변경 규칙
--   조사관: 임시저장 → 제출, 반려된 자료 수정 → 재제출만 가능. 제출된 자료는 고칠 수 없고, 반려도 할 수 없다.
--   관리자: 제출된 자료를 사유를 적어 반려만 할 수 있다. 자료 내용은 고칠 수 없다.
--   서버 관리 키(로그인 사용자 없음)는 예외로 통과시킨다.
create function public.enforce_submission_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor public.user_role;
begin
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

create trigger submissions_rules before update on public.submissions
  for each row execute function public.enforce_submission_rules();

-- 산출 결과 상태는 정해진 순서로만 바뀐다 (누가 바꾸든 같다)
--   산출됨 → 검증 완료 → 공개 → 철회됨 → 산출됨(재산출) → …
--   검증 완료 → 산출됨(자료가 바뀌어 재산출)
create function public.enforce_result_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if (old.status, new.status) in (
    ('calculated', 'verified'),
    ('verified', 'published'),
    ('published', 'withdrawn'),
    ('withdrawn', 'calculated'),
    ('verified', 'calculated')
  ) then
    return new;
  end if;

  raise exception '결과 상태를 % 에서 % 로 바꿀 수 없습니다. (검증 완료 전에는 공개할 수 없습니다)', old.status, new.status;
end;
$$;

create trigger round_results_transition before update on public.round_results
  for each row execute function public.enforce_result_transition();

-- ============================================================
-- 5. 행 단위 접근 규칙 (RLS)
--    규칙을 만들지 않은 동작은 모두 막힌다. 서버 관리 키는 이 규칙을 건너뛴다.
-- ============================================================

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.round_institutions enable row level security;
alter table public.submissions enable row level security;
alter table public.round_results enable row level security;
alter table public.estimates enable row level security;
alter table public.institution_indicators enable row level security;
alter table public.comments enable row level security;
alter table public.publish_log enable row level security;
alter table public.reference_stats enable row level security;
alter table public.app_settings enable row level security;

-- 로그인하지 않은 사용자는 어떤 표도 볼 수 없다
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- 변경 이력은 쌓기만 하고 고치거나 지우지 못한다
revoke update, delete on public.publish_log from authenticated;

-- ---- profiles
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');

-- ---- institutions
create policy institutions_admin_all on public.institutions
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy institutions_surveyor_select on public.institutions
  for select to authenticated
  using (
    public.app_user_role() = 'surveyor'
    and exists (
      select 1 from public.round_institutions ri
      where ri.institution_id = institutions.id and ri.surveyor_id = auth.uid()
    )
  );
create policy institutions_institution_select_own on public.institutions
  for select to authenticated
  using (public.app_user_role() = 'institution' and id = public.app_institution_id());

-- ---- rounds
create policy rounds_admin_all on public.rounds
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy rounds_surveyor_select on public.rounds
  for select to authenticated
  using (public.app_user_role() = 'surveyor');
create policy rounds_institution_select_published on public.rounds
  for select to authenticated
  using (public.app_user_role() = 'institution' and public.app_round_published(id));

-- ---- round_institutions
create policy round_institutions_admin_all on public.round_institutions
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy round_institutions_surveyor_select on public.round_institutions
  for select to authenticated
  using (public.app_user_role() = 'surveyor' and surveyor_id = auth.uid());

-- ---- submissions
create policy submissions_admin_select on public.submissions
  for select to authenticated
  using (public.app_user_role() = 'admin');
create policy submissions_admin_update on public.submissions
  for update to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy submissions_surveyor_select on public.submissions
  for select to authenticated
  using (public.app_surveyor_assigned(round_id, institution_id));
-- 조사관은 오픈된 회차에 임시저장 상태로만 새로 만들 수 있다
create policy submissions_surveyor_insert on public.submissions
  for insert to authenticated
  with check (
    public.app_surveyor_assigned(round_id, institution_id)
    and status = 'draft'
    and public.app_round_is_open(round_id)
  );
-- 수정은 (오픈된 회차의 임시저장 자료) 또는 (반려된 자료, 입력 기간이 끝났어도)만 가능하다
create policy submissions_surveyor_update on public.submissions
  for update to authenticated
  using (
    public.app_surveyor_assigned(round_id, institution_id)
    and (status = 'returned' or (status = 'draft' and public.app_round_is_open(round_id)))
  )
  with check (public.app_surveyor_assigned(round_id, institution_id));
-- 의료기관은 공개된 회차의 본인 기관 자료만 볼 수 있다
create policy submissions_institution_select_published on public.submissions
  for select to authenticated
  using (
    public.app_user_role() = 'institution'
    and institution_id = public.app_institution_id()
    and public.app_round_published(round_id)
  );

-- ---- round_results
create policy round_results_admin_all on public.round_results
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy round_results_institution_select_published on public.round_results
  for select to authenticated
  using (public.app_user_role() = 'institution' and status = 'published');

-- ---- estimates (공개된 회차이면서 응답 기관 수가 기준 이상인 구간만)
create policy estimates_admin_all on public.estimates
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy estimates_institution_select on public.estimates
  for select to authenticated
  using (
    public.app_user_role() = 'institution'
    and public.app_round_published(round_id)
    and sample_count >= public.app_min_group_size()
  );

-- ---- institution_indicators
create policy indicators_admin_all on public.institution_indicators
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy indicators_institution_select_own on public.institution_indicators
  for select to authenticated
  using (
    public.app_user_role() = 'institution'
    and institution_id = public.app_institution_id()
    and public.app_round_published(round_id)
  );

-- ---- comments
create policy comments_admin_all on public.comments
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy comments_institution_select_own on public.comments
  for select to authenticated
  using (
    public.app_user_role() = 'institution'
    and institution_id = public.app_institution_id()
    and public.app_round_published(round_id)
  );

-- ---- publish_log (관리자만 보고 추가한다)
create policy publish_log_admin_select on public.publish_log
  for select to authenticated
  using (public.app_user_role() = 'admin');
create policy publish_log_admin_insert on public.publish_log
  for insert to authenticated
  with check (public.app_user_role() = 'admin' and performed_by = auth.uid());

-- ---- reference_stats
create policy reference_stats_admin_all on public.reference_stats
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
create policy reference_stats_institution_select on public.reference_stats
  for select to authenticated
  using (public.app_user_role() = 'institution' and public.app_round_published(round_id));

-- ---- app_settings (관리자만)
create policy app_settings_admin_all on public.app_settings
  for all to authenticated
  using (public.app_user_role() = 'admin')
  with check (public.app_user_role() = 'admin');
