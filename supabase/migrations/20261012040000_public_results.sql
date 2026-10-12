-- 공표된 결과를 로그인 없이 누구나 볼 수 있게 한다. (PRD: 공표된 결과는 누구나, 기관별 개별 결과는 해당 기관만)
--
-- 원칙
--   · 표(estimates, round_results, submissions 등)는 그대로 로그인하지 않은 사람에게 닫아 둔다.
--   · 누구나 읽는 것은 아래 "공개용 조회" 3개뿐이다. 이 조회는 집계 값만 담고, 기관 id·기관명·입력 자료·지표·코멘트·관리자 id가 없다.
--   · 공개 상태인 회차만 나오고, 응답 기관이 기준(기본 5곳) 미만인 종별은 나오지 않으며, 전체 합계 행은 없다.
--   · 공개를 철회하면 이 조회에서 즉시 사라진다.
--   · 조회는 만든 사람 권한으로 실행되므로(표를 직접 열어 주지 않기 위해), 걸러내는 조건을 조회 안에 직접 둔다.

-- 공표된 회차 목록
create view public.public_rounds as
  select
    r.id as round_id,
    r.name as round_name,
    r.year,
    rr.published_at
  from public.rounds r
  join public.round_results rr on rr.round_id = r.id
  where rr.status = 'published';

-- 공표된 회차의 참여 현황 (집계 숫자만)
create view public.public_participation as
  select
    r.id as round_id,
    sub.submitted_count,
    rs.total_institution_count,
    case when coalesce(rs.total_institution_count, 0) > 0
      then round(100.0 * sub.submitted_count / rs.total_institution_count, 1)
    end as participation_rate_pct
  from public.rounds r
  join public.round_results rr on rr.round_id = r.id and rr.status = 'published'
  left join public.reference_stats rs on rs.round_id = r.id
  left join lateral (
    select count(*)::integer as submitted_count
    from public.submissions s
    where s.round_id = r.id and s.status = 'submitted'
  ) sub on true;

-- 공표된 회차의 기관 종별 추정치 (응답 기관 수가 기준 이상인 종별만, 합계 행 없음)
create view public.public_estimates as
  select
    e.round_id,
    e.institution_type,
    e.sample_count,
    e.estimate_values,
    e.method_note
  from public.estimates e
  join public.round_results rr on rr.round_id = e.round_id
  where rr.status = 'published'
    and e.sample_count >= public.app_min_group_size();

revoke all on public.public_rounds from anon, authenticated;
revoke all on public.public_participation from anon, authenticated;
revoke all on public.public_estimates from anon, authenticated;

grant select on public.public_rounds to anon, authenticated;
grant select on public.public_participation to anon, authenticated;
grant select on public.public_estimates to anon, authenticated;
