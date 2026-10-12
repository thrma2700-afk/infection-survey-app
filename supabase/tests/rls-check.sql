-- 데이터 구조·접근 규칙 점검 (DESIGN.md 5장, PRD 노출 규칙)
-- 임시 사용자와 자료를 만들어 역할별로 "보여야 할 것은 보이고, 막아야 할 것은 막히는지" 확인한다.
-- 끝에서 일부러 오류(RLS_CHECK_PASSED)를 내어 만든 자료를 모두 되돌리므로, 실제 데이터에는 남지 않는다.
-- 실행: npm run check:schema

-- 임시 도우미: 지정한 사용자('anon' | 'owner' | 사용자 id)로 바꿔서 실행한다
create function pg_temp.act(actor text) returns void language plpgsql as $f$
begin
  reset role;
  if actor = 'owner' then
    perform set_config('request.jwt.claims', '', true);
  elsif actor = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end $f$;

-- 실행 결과(숫자 하나)가 기대한 값인지 확인한다
create function pg_temp.expect_count(actor text, stmt text, expected integer, label text) returns void language plpgsql as $f$
declare n integer;
begin
  perform pg_temp.act(actor);
  begin
    execute stmt into n;
  exception when others then
    perform pg_temp.act('owner');
    raise exception 'FAIL: % (예상하지 못한 오류: %)', label, sqlerrm;
  end;
  perform pg_temp.act('owner');
  if n is distinct from expected then
    raise exception 'FAIL: % (기대 %건, 실제 %건)', label, expected, n;
  end if;
end $f$;

-- 실행하면 오류로 막혀야 하는 동작인지 확인한다
create function pg_temp.expect_fail(actor text, stmt text, label text) returns void language plpgsql as $f$
declare blocked boolean := false;
begin
  perform pg_temp.act(actor);
  begin
    execute stmt;
  exception when others then
    blocked := true;
  end;
  perform pg_temp.act('owner');
  if not blocked then
    raise exception 'FAIL: % (막혀야 하는데 통과함)', label;
  end if;
end $f$;

do $$
declare
  admin_id uuid := gen_random_uuid();
  sur_id uuid := gen_random_uuid();   -- 배정된 조사관
  sur2_id uuid := gen_random_uuid();  -- 배정되지 않은 조사관
  u1 uuid := gen_random_uuid();       -- 의료기관 1 담당자(승인됨)
  u2 uuid := gen_random_uuid();       -- 의료기관 2 담당자(승인됨)
  up uuid := gen_random_uuid();       -- 의료기관 1 소속, 승인 대기
  i1 uuid := gen_random_uuid();
  i2 uuid := gen_random_uuid();
  i3 uuid := gen_random_uuid();
  i4 uuid := gen_random_uuid();       -- 자료가 아직 없는 기관
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  r3 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid();       -- 새로 발급하는 조사관
  u5 uuid := gen_random_uuid();       -- 종별이 없는 기관의 담당자
  i5 uuid := gen_random_uuid();       -- 종별이 없는 기관
  i6 uuid := gen_random_uuid();       -- 가입 승인 시험용 기관
  u6 uuid := gen_random_uuid();       -- 가입 신청자 1
  u7 uuid := gen_random_uuid();       -- 가입 신청자 2 (같은 기관)
begin
  -- ===== 임시 자료 준비 (소유자 권한) =====
  insert into auth.users (id, email) values
    (admin_id, 'rls-admin@test.invalid'), (sur_id, 'rls-sur@test.invalid'), (sur2_id, 'rls-sur2@test.invalid'),
    (u1, 'rls-u1@test.invalid'), (u2, 'rls-u2@test.invalid'), (up, 'rls-up@test.invalid');
  insert into public.institution_types (name) values ('상급종합'), ('종합병원'), ('병원');
  insert into public.institutions (id, name, ykiho_code, institution_type) values
    (i1, '테스트병원1', 'RLS-T1', '상급종합'), (i2, '테스트병원2', 'RLS-T2', '종합병원'), (i3, '테스트병원3', 'RLS-T3', '병원'),
    (i4, '테스트병원4', 'RLS-T4', '병원');
  insert into public.profiles (id, name, email, role, institution_id, approval_status) values
    (admin_id, '관리자', 'rls-admin@test.invalid', 'admin', null, 'approved'),
    (sur_id, '조사관', 'rls-sur@test.invalid', 'surveyor', null, 'approved'),
    (sur2_id, '조사관2', 'rls-sur2@test.invalid', 'surveyor', null, 'approved'),
    (u1, '담당자1', 'rls-u1@test.invalid', 'institution', i1, 'approved'),
    (u2, '담당자2', 'rls-u2@test.invalid', 'institution', i2, 'approved'),
    (up, '대기자', 'rls-up@test.invalid', 'institution', i1, 'pending');
  insert into public.rounds (id, name, year, is_open) values (r1, '테스트회차', 2026, true);
  insert into public.round_institutions (round_id, institution_id, surveyor_id) values
    (r1, i1, sur_id), (r1, i2, sur_id), (r1, i3, sur_id), (r1, i4, sur_id);
  insert into public.submissions (round_id, institution_id, status, answers) values
    (r1, i2, 'submitted', '{"k":1}'),   -- 다른 기관의 자료 (노출되면 안 된다)
    (r1, i3, 'draft', '{"k":1}');
  insert into public.round_results (round_id) values (r1);
  insert into public.estimates (round_id, institution_type, sample_count, estimate_values, method_note) values
    (r1, '상급종합', 3, '{}', '기준'),   -- 5곳 미만: 숨겨져야 한다
    (r1, '종합병원', 6, '{}', '기준');   -- 5곳 이상: 보여야 한다
  insert into public.institution_indicators (round_id, institution_id, indicator_values) values
    (r1, i1, '{}'), (r1, i2, '{}');
  insert into public.comments (round_id, institution_id, body, author_id) values
    (r1, i1, '코멘트1', admin_id), (r1, i2, '코멘트2', admin_id);
  insert into public.reference_stats (round_id, total_institution_count) values (r1, 100);

  -- ===== A. 로그인하지 않은 사용자 =====
  perform pg_temp.expect_fail('anon', 'select count(*) from public.institutions', 'A1 로그인 전에는 의료기관 표를 읽을 수 없다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.submissions', 'A2 로그인 전에는 조사 자료를 읽을 수 없다');

  -- ===== B. 의료기관(승인됨): 공개 전에는 아무 결과도 보이지 않는다 =====
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.submissions', 0, 'B1 공개 전 조사 자료 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.round_results', 0, 'B2 공개 전 결과 상태 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.estimates', 0, 'B3 공개 전 추정치 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.institution_indicators', 0, 'B4 공개 전 기관별 지표 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.comments', 0, 'B5 공개 전 코멘트 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.rounds', 0, 'B6 공개 전 회차 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.reference_stats', 0, 'B7 공개 전 기준 통계 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.round_institutions', 0, 'B8 배정 정보 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.app_settings', 0, 'B9 설정 값 비노출');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.institutions', 1, 'B10 의료기관은 본인 기관만 보인다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.profiles', 1, 'B11 사용자 정보는 본인 것만 보인다');

  -- ===== C. 승인 대기 계정: 아무것도 볼 수 없다 =====
  perform pg_temp.expect_count(up::text, 'select count(*) from public.institutions', 0, 'C1 승인 전에는 소속 기관도 볼 수 없다');
  perform pg_temp.expect_count(up::text, 'select count(*) from public.profiles', 1, 'C2 승인 전에도 본인 계정 정보는 볼 수 있다(승인 대기 안내용)');

  -- ===== D. 조사관: 배정된 기관만 =====
  perform pg_temp.expect_count(sur_id::text, 'select count(*) from public.institutions', 4, 'D1 배정된 기관만 보인다');
  perform pg_temp.expect_count(sur2_id::text, 'select count(*) from public.institutions', 0, 'D2 배정되지 않은 조사관에게는 기관이 보이지 않는다');
  perform pg_temp.expect_count(sur2_id::text, 'select count(*) from public.submissions', 0, 'D3 배정되지 않은 조사관에게는 조사 자료가 보이지 않는다');
  perform pg_temp.expect_count(sur_id::text, 'select count(*) from public.estimates', 0, 'D4 조사관은 산출 결과를 볼 수 없다');
  perform pg_temp.expect_count(sur_id::text, 'select count(*) from public.comments', 0, 'D5 조사관은 코멘트를 볼 수 없다');

  -- ===== E. 조사 자료 입력·제출·반려·재제출 =====
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (insert into public.submissions (round_id, institution_id, status, answers) values (%L, %L, ''draft'', ''{"a":1}'') returning 1) select count(*) from x', r1, i1),
    1, 'E1 오픈된 회차에 임시저장을 만들 수 있다');
  perform pg_temp.expect_fail(sur2_id::text,
    format('insert into public.submissions (round_id, institution_id, status, answers) values (%L, %L, ''draft'', ''{}'')', r1, i4),
    'E2 배정되지 않은 조사관은 자료를 만들 수 없다');
  perform pg_temp.expect_fail(sur_id::text,
    format('update public.submissions set status = ''returned'' where round_id = %L and institution_id = %L', r1, i3),
    'E3 조사관은 스스로 반려 상태로 바꿀 수 없다');
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (update public.submissions set status = ''submitted'' where round_id = %L and institution_id = %L returning 1) select count(*) from x', r1, i1),
    1, 'E4 임시저장을 제출할 수 있다');
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (update public.submissions set answers = ''{"a":2}'' where round_id = %L and institution_id = %L returning 1) select count(*) from x', r1, i1),
    0, 'E5 제출된 자료는 조사관이 고칠 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.submissions set status = ''returned'' where round_id = %L and institution_id = %L', r1, i1),
    'E6 사유 없이는 반려할 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.submissions set answers = ''{"a":9}'' where round_id = %L and institution_id = %L', r1, i1),
    'E7 관리자는 자료 내용을 직접 고칠 수 없다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.submissions set status = ''returned'', return_reason = ''수치 확인 필요'' where round_id = %L and institution_id = %L returning 1) select count(*) from x', r1, i1),
    1, 'E8 사유를 적으면 반려할 수 있다');

  perform pg_temp.expect_fail(sur_id::text,
    format('update public.submissions set institution_id = %L where round_id = %L and institution_id = %L', i4, r1, i1),
    'E8-1 조사관은 자료를 다른 기관으로 옮길 수 없다');

  -- 입력 기간이 끝난(마감된) 뒤
  update public.rounds set is_open = false, closed_at = now() where id = r1;
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (update public.submissions set answers = ''{"a":3}'' where round_id = %L and institution_id = %L returning 1) select count(*) from x', r1, i1),
    1, 'E9 마감 뒤에도 반려된 자료는 수정할 수 있다');
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (update public.submissions set answers = ''{"k":2}'' where round_id = %L and institution_id = %L returning 1) select count(*) from x', r1, i3),
    0, 'E10 마감 뒤에는 반려되지 않은 임시저장을 고칠 수 없다');
  perform pg_temp.expect_fail(sur_id::text,
    format('insert into public.submissions (round_id, institution_id, status, answers) values (%L, %L, ''draft'', ''{}'')', r1, i4),
    'E11 마감된 회차에는 새 자료를 만들 수 없다');
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (update public.submissions set status = ''submitted'' where round_id = %L and institution_id = %L returning 1) select count(*) from x', r1, i1),
    1, 'E12 마감 뒤에도 반려된 자료는 재제출할 수 있다');

  -- ===== F. 결과 상태 순서와 공개 =====
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.round_results set status = ''published'' where round_id = %L', r1),
    'F1 검증 완료 전에는 공개할 수 없다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''verified'', verified_at = now(), verified_by = %L where round_id = %L returning 1) select count(*) from x', admin_id, r1),
    1, 'F2 산출됨 → 검증 완료');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.submissions', 0, 'F3 검증 완료 상태에서도 의료기관에는 보이지 않는다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''published'', published_at = now(), published_by = %L where round_id = %L returning 1) select count(*) from x', admin_id, r1),
    1, 'F4 검증 완료 → 공개');

  -- 공개 후: 의료기관 1
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.submissions', 1, 'G1 공개 후 본인 기관 자료 1건만 보인다');
  perform pg_temp.expect_count(u1::text, format('select count(*) from public.submissions where institution_id = %L', i2), 0, 'G2 다른 기관의 자료는 보이지 않는다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.institution_round_results', 1, 'G3 공개된 회차의 상태가 보인다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.estimates', 1, 'G4 응답 5곳 미만 구간(3곳)은 숨겨지고 6곳 구간만 보인다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.institution_indicators', 1, 'G5 본인 기관 지표만 보인다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.institution_comments', 1, 'G6 본인 기관 코멘트만 보인다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.rounds', 1, 'G7 공개된 회차가 보인다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.reference_stats', 1, 'G8 공개된 회차의 기준 통계가 보인다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.institutions', 1, 'G9 의료기관은 본인 기관만 보인다');
  perform pg_temp.expect_count(u2::text, format('select count(*) from public.submissions where institution_id = %L', i1), 0, 'G10 의료기관 2에게 기관 1의 자료는 보이지 않는다');
  perform pg_temp.expect_count(u2::text, format('select count(*) from public.submissions where institution_id = %L', i2), 1, 'G11 의료기관 2는 본인 기관 자료가 보인다');
  perform pg_temp.expect_count(up::text, 'select count(*) from public.submissions', 0, 'G12 승인 대기 계정에는 공개 후에도 보이지 않는다');
  perform pg_temp.expect_count(sur_id::text, 'select count(*) from public.estimates', 0, 'G13 조사관에게는 공개 후에도 산출 결과가 보이지 않는다');

  -- 의료기관은 읽기만 가능
  perform pg_temp.expect_count(u1::text, 'with x as (update public.comments set body = ''고침'' returning 1) select count(*) from x', 0, 'H1 의료기관은 코멘트를 고칠 수 없다');
  perform pg_temp.expect_fail(u1::text,
    format('insert into public.comments (round_id, institution_id, body) values (%L, %L, ''x'')', r1, i1),
    'H2 의료기관은 코멘트를 만들 수 없다');
  perform pg_temp.expect_count(u1::text,
    format('with x as (update public.profiles set role = ''admin'' where id = %L returning 1) select count(*) from x', u1),
    0, 'H3 사용자는 자기 역할을 바꿀 수 없다');
  perform pg_temp.expect_count(u1::text, 'with x as (update public.submissions set answers = ''{}'' returning 1) select count(*) from x', 0, 'H4 의료기관은 조사 자료를 고칠 수 없다');

  -- ===== I. 변경 이력 =====
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from public.publish_log where round_id = %L and action = ''publish'' and performed_by = %L', r1, admin_id),
    1, 'I1 공개하면 공개 이력이 수행한 관리자와 함께 자동으로 남는다');
  perform pg_temp.expect_fail(admin_id::text,
    format('insert into public.publish_log (round_id, action, reason, performed_by) values (%L, ''withdraw'', ''직접'', %L)', r1, admin_id),
    'I2 이력은 사람이 직접 넣을 수 없다');
  perform pg_temp.expect_fail(admin_id::text, 'update public.publish_log set reason = ''고침''', 'I3 이력은 고칠 수 없다');
  perform pg_temp.expect_fail(admin_id::text, 'delete from public.publish_log', 'I4 이력은 지울 수 없다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.publish_log', 0, 'I5 의료기관은 변경 이력을 볼 수 없다');

  -- ===== J. 공개 철회 =====
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.round_results set status = ''withdrawn'' where round_id = %L', r1),
    'J0 사유 없이는 공개를 철회할 수 없다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''withdrawn'', status_reason = ''자료 오류 발견'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'J1 공개 → 철회됨');
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from public.publish_log where round_id = %L and action = ''withdraw'' and reason = ''자료 오류 발견'' and performed_by = %L', r1, admin_id),
    1, 'J1-1 철회하면 사유와 수행한 관리자가 이력에 자동으로 남는다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.submissions', 0, 'J2 철회하면 즉시 자료가 보이지 않는다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.institution_comments', 0, 'J3 철회하면 즉시 코멘트가 보이지 않는다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.estimates', 0, 'J4 철회하면 즉시 추정치가 보이지 않는다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.rounds', 0, 'J5 철회하면 즉시 회차가 보이지 않는다');
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.round_results set status = ''published'' where round_id = %L', r1),
    'J6 철회된 결과는 재산출·재검증 없이 다시 공개할 수 없다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''calculated'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'J7 철회됨 → 산출됨(재산출)');

  -- ===== K. 기타 규칙 =====
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.app_settings', 0, 'K1 설정 값은 의료기관에게 보이지 않는다');
  perform pg_temp.expect_count(admin_id::text, 'select count(*) from public.app_settings', 1, 'K2 관리자는 설정 값을 볼 수 있다');
  insert into public.rounds (id, name, year, is_open) values (r2, '두 번째 회차', 2027, true);
  perform pg_temp.expect_fail('owner',
    format('insert into public.rounds (id, name, year, is_open) values (%L, ''세 번째 회차'', 2028, true)', r3),
    'K3 오픈된 회차는 한 번에 하나만 가능하다');
  perform pg_temp.expect_fail('owner',
    format('update public.profiles set institution_id = null where id = %L', u1),
    'K4 의료기관 계정은 소속 기관이 반드시 있어야 한다');

  -- ===== L. 공개 중에는 바탕 자료를 바꿀 수 없고, 의료기관에는 제출된 자료만 보인다 =====
  -- (이 시점의 결과 상태는 "산출됨", 기관 1의 자료는 제출 상태)
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.submissions set status = ''returned'', return_reason = ''재확인'' where round_id = %L and institution_id = %L returning 1) select count(*) from x', r1, i1),
    1, 'L1 공개 전에는 제출된 자료를 반려할 수 있다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''verified'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'L2 산출됨 → 검증 완료');
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.round_results set status = ''published'' where round_id = %L', r1),
    'L2-1 재공개할 때는 사유를 반드시 적어야 한다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''published'', status_reason = ''정정 후 재공개'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'L3 검증 완료 → 공개(재공개)');
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from public.publish_log where round_id = %L and action = ''republish'' and reason = ''정정 후 재공개''', r1),
    1, 'L3-1 재공개 이력이 사유와 함께 자동으로 남는다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.submissions', 0, 'L4 반려 상태(수정 중)인 자료는 공개돼도 의료기관에 보이지 않는다');
  perform pg_temp.expect_count(u2::text, 'select count(*) from public.submissions', 1, 'L5 제출 상태인 자료는 보인다');
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.submissions set status = ''returned'', return_reason = ''공개 중 반려'' where round_id = %L and institution_id = %L', r1, i2),
    'L6 공개 중에는 관리자도 자료를 반려할 수 없다');
  perform pg_temp.expect_fail(sur_id::text,
    format('update public.submissions set answers = ''{"a":7}'' where round_id = %L and institution_id = %L', r1, i1),
    'L7 공개 중에는 조사관도 반려된 자료를 고칠 수 없다');
  perform pg_temp.expect_fail(admin_id::text, 'update public.estimates set sample_count = 9', 'L8 공개 중에는 추정치를 바꿀 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    format('delete from public.round_results where round_id = %L', r1),
    'L9 공개 중인 결과는 지울 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    format('insert into public.round_results (round_id, status) values (%L, ''published'')', r2),
    'L10 결과를 처음부터 공개 상태로 만들 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    format('insert into public.round_results (round_id, status) values (%L, ''verified'')', r2),
    'L11 결과를 처음부터 검증 완료 상태로 만들 수 없다');

  -- 철회한 뒤 자료가 바뀌면 "산출됨"으로 돌아가고, 다시 검증해야 한다
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''withdrawn'', status_reason = ''재확인 필요'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'L12 공개 → 철회됨');
  perform pg_temp.expect_count(admin_id::text,
    'with x as (update public.estimates set sample_count = 7 returning 1) select count(*) from x',
    2, 'L13 철회 뒤에는 추정치를 다시 산출할 수 있다');
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.round_results where round_id = %L and status = ''calculated''', r1),
    1, 'L14 재산출하면 결과 상태가 산출됨으로 돌아간다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''verified'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'L15 산출됨 → 검증 완료');
  perform pg_temp.expect_count(admin_id::text,
    'with x as (update public.institution_indicators set indicator_values = ''{"v":1}'' returning 1) select count(*) from x',
    2, 'L16 검증 완료 뒤 지표를 고칠 수 있다');
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.round_results where round_id = %L and status = ''calculated''', r1),
    1, 'L17 검증 완료 뒤 지표가 바뀌면 산출됨으로 돌아간다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''verified'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'L18 다시 검증 완료');
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (update public.submissions set status = ''submitted'' where round_id = %L and institution_id = %L returning 1) select count(*) from x', r1, i1),
    1, 'L19 검증 완료 뒤 반려된 자료가 재제출된다');
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.round_results where round_id = %L and status = ''calculated''', r1),
    1, 'L20 조사 자료가 바뀌면 검증 완료 결과가 산출됨으로 돌아간다');

  -- ===== M. 데이터 무결성 (13번·7번·8번·9번·10번·11번 보강) =====
  -- (이 시점의 결과 상태는 "산출됨")
  perform pg_temp.expect_fail('owner',
    format('update public.profiles set approval_status = ''approved'' where id = %L', up),
    'M1 한 기관에 승인된 담당자는 1명만 둘 수 있다');

  perform pg_temp.expect_fail(admin_id::text,
    format('insert into public.estimates (round_id, institution_type, sample_count, estimate_values, method_note) values (%L, ''전체'', 9, ''{}'', ''합계'')', r1),
    'M2 추정치에 전체 합계 행을 넣을 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    'update public.estimates set estimate_values = ''{"합계": 1}''',
    'M3 추정치 값에 합계 항목을 넣을 수 없다');

  perform pg_temp.expect_fail(admin_id::text,
    format('update public.submissions set return_reason = ''변조'' where round_id = %L and institution_id = %L', r1, i2),
    'M4 관리자는 반려 사유를 반려 때가 아니면 고칠 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.submissions set submitted_at = now() - interval ''30 days'' where round_id = %L and institution_id = %L', r1, i2),
    'M5 관리자는 제출 일시를 바꿀 수 없다');

  -- 반려된 자료(기관 3)에서 조사관이 반려 기록을 지우려는 경우
  update public.submissions
    set status = 'returned', return_reason = '확인 필요', returned_at = now()
    where round_id = r1 and institution_id = i3;
  perform pg_temp.expect_fail(sur_id::text,
    format('update public.submissions set return_reason = null where round_id = %L and institution_id = %L', r1, i3),
    'M6 조사관은 반려 사유를 지울 수 없다');
  perform pg_temp.expect_fail(sur_id::text,
    format('update public.submissions set returned_at = now() + interval ''1 day'' where round_id = %L and institution_id = %L', r1, i3),
    'M7 조사관은 반려 일시를 바꿀 수 없다');

  -- 새 자료를 만들 때 제출·반려 기록을 미리 채워 넣는 경우 (오픈된 회차 r2)
  insert into public.round_institutions (round_id, institution_id, surveyor_id) values (r2, i1, sur_id);
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (insert into public.submissions (round_id, institution_id, status, answers, submitted_at, returned_at, return_reason) values (%L, %L, ''draft'', ''{}'', now() - interval ''9 days'', now(), ''가짜'') returning 1) select count(*) from x', r2, i1),
    1, 'M8 오픈된 회차에 임시저장을 만든다');
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.submissions where round_id = %L and submitted_at is null and returned_at is null and return_reason is null', r2),
    1, 'M9 새 자료에 미리 채워 넣은 제출·반려 기록은 지워진다');

  -- 반려·제출 이력
  perform pg_temp.expect_count(admin_id::text,
    'select case when count(*) >= 2 then 1 else 0 end from public.submission_history where event = ''returned''',
    1, 'M10 반려할 때마다 이력이 쌓인다(사유가 덮어써져도 이전 반려가 남는다)');
  perform pg_temp.expect_count(admin_id::text,
    'select case when count(*) >= 2 then 1 else 0 end from public.submission_history where event = ''submitted''',
    1, 'M11 제출·재제출 이력이 쌓인다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.submission_history', 0, 'M12 의료기관은 반려·제출 이력을 볼 수 없다');
  perform pg_temp.expect_count(sur_id::text, 'select count(*) from public.submission_history', 0, 'M13 조사관은 반려·제출 이력을 직접 볼 수 없다');
  perform pg_temp.expect_fail(admin_id::text, 'delete from public.submission_history', 'M14 반려·제출 이력은 지울 수 없다');

  -- 지우기 보호
  perform pg_temp.expect_fail(admin_id::text,
    format('delete from public.rounds where id = %L', r1),
    'M15 조사 자료·결과가 있는 회차는 지울 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    format('delete from public.round_institutions where round_id = %L and institution_id = %L', r1, i1),
    'M16 조사 자료가 있는 조사 대상은 뺄 수 없다');
  insert into public.rounds (id, name, year, is_open) values (r3, '자료 없는 회차', 2029, false);
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (delete from public.rounds where id = %L returning 1) select count(*) from x', r3),
    1, 'M17 자료가 없는 회차는 지울 수 있다');

  -- 이력의 수행자는 반드시 있어야 한다
  perform pg_temp.expect_fail('owner',
    format('insert into public.publish_log (round_id, action, performed_by) values (%L, ''publish'', null)', r1),
    'M18 이력에는 수행한 관리자가 반드시 있어야 한다');

  -- ===== N. 점검 후속 보완 (승인 기본값·종별·회차 목록·일시·비노출·측정) =====
  -- 승인 기본값: 관리자가 발급하는 조사관·관리자 계정은 승인 상태로 시작한다
  insert into auth.users (id, email) values (u3, 'rls-new-sur@test.invalid');
  insert into public.profiles (id, name, email, role, approval_status)
    values (u3, '새 조사관', 'rls-new-sur@test.invalid', 'surveyor', 'pending');
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.profiles where id = %L and approval_status = ''approved''', u3),
    1, 'N1 조사관 계정은 승인 상태로 시작한다');

  -- 종별: 종별이 없는 기관의 담당자는 승인할 수 없고, 종별은 관리자만 정한다
  insert into public.institutions (id, name, ykiho_code) values (i5, '종별 없는 병원', 'RLS-T5');
  insert into auth.users (id, email) values (u5, 'rls-u5@test.invalid');
  insert into public.profiles (id, name, email, role, institution_id)
    values (u5, '담당자5', 'rls-u5@test.invalid', 'institution', i5);
  perform pg_temp.expect_fail('owner',
    format('update public.profiles set approval_status = ''approved'' where id = %L', u5),
    'N2 기관 종별이 없으면 의료기관 가입을 승인할 수 없다');
  perform pg_temp.expect_count(u1::text,
    format('with x as (update public.institutions set institution_type = ''병원'' where id = %L returning 1) select count(*) from x', i1),
    0, 'N3 의료기관은 기관 종별을 바꿀 수 없다');
  perform pg_temp.expect_count(sur_id::text,
    format('with x as (update public.institutions set institution_type = ''병원'' where id = %L returning 1) select count(*) from x', i1),
    0, 'N4 조사관은 기관 종별을 바꿀 수 없다');
  perform pg_temp.expect_fail(admin_id::text,
    format('update public.institutions set institution_type = ''없는 종별'' where id = %L', i5),
    'N5 종별은 관리자가 등록한 목록에 있는 값만 쓸 수 있다');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.institutions set institution_type = ''병원'' where id = %L returning 1) select count(*) from x', i5),
    1, 'N6 관리자는 기관 종별을 지정할 수 있다');
  perform pg_temp.expect_count('owner',
    format('with x as (update public.profiles set approval_status = ''approved'' where id = %L returning 1) select count(*) from x', u5),
    1, 'N7 종별이 지정되면 의료기관 가입을 승인할 수 있다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.institution_types', 0, 'N8 의료기관은 종별 목록을 볼 수 없다');

  -- 조사관은 배정된 회차만 본다 (이 시점: 회차 1·2에 배정)
  perform pg_temp.expect_count(sur_id::text, 'select count(*) from public.rounds', 2, 'N9 조사관에게는 배정된 회차만 보인다');
  perform pg_temp.expect_count(sur2_id::text, 'select count(*) from public.rounds', 0, 'N10 배정이 없는 조사관에게는 회차가 보이지 않는다');

  -- 오픈·마감 일시는 자동으로 기록된다
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.rounds where id = %L and opened_at is not null and closed_at is null', r2),
    1, 'N11 오픈하면 오픈 일시가 자동으로 기록된다');
  update public.rounds set is_open = false where id = r2;
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.rounds where id = %L and closed_at is not null', r2),
    1, 'N12 마감하면 마감 일시가 자동으로 기록된다');

  -- 의료기관에는 관리자 id 같은 내부 정보가 보이지 않는다
  perform pg_temp.expect_fail(u1::text, 'select published_by from public.institution_round_results', 'N13 의료기관용 결과 뷰에는 관리자 id 칸이 없다');
  perform pg_temp.expect_fail(u1::text, 'select author_id from public.institution_comments', 'N14 의료기관용 코멘트 뷰에는 작성자 id 칸이 없다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.round_results', 0, 'N15 의료기관은 결과 표를 직접 읽을 수 없다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.comments', 0, 'N16 의료기관은 코멘트 표를 직접 읽을 수 없다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.institution_comments', 'N17 로그인하지 않으면 코멘트 뷰를 읽을 수 없다');

  -- 운영 후 측정 뷰는 관리자만 본다
  perform pg_temp.expect_count(admin_id::text, format('select count(*) from public.round_metrics where round_id = %L', r1), 1, 'N18 관리자는 회차별 측정 값을 볼 수 있다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.round_metrics', 0, 'N19 의료기관은 측정 값을 볼 수 없다');
  perform pg_temp.expect_count(sur_id::text, 'select count(*) from public.round_metrics', 0, 'N20 조사관은 측정 값을 볼 수 없다');
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from public.round_metrics where round_id = %L and days_to_publish is not null and participation_rate_pct is not null', r1),
    1, 'N21 공표까지 기간과 참여율이 계산된다');

  -- ===== O. 공표된 결과는 누구나, 기관별 개별 결과는 해당 기관만 =====
  -- (이 시점의 결과 상태는 "산출됨", 추정치 두 종별의 표본 수는 7, 제출된 기관은 2곳)
  perform pg_temp.expect_count('anon', 'select count(*) from public.public_rounds', 0, 'O1 공개 전에는 로그인하지 않은 사람에게 회차가 보이지 않는다');
  perform pg_temp.expect_count('anon', 'select count(*) from public.public_estimates', 0, 'O2 공개 전에는 추정치가 보이지 않는다');
  perform pg_temp.expect_count('anon', 'select count(*) from public.public_participation', 0, 'O3 공개 전에는 참여 현황이 보이지 않는다');

  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''verified'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'O4 산출됨 → 검증 완료');
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''published'', status_reason = ''공개용 조회 시험'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'O5 검증 완료 → 공개');

  perform pg_temp.expect_count('anon', 'select count(*) from public.public_rounds', 1, 'O6 공개되면 로그인하지 않은 사람도 회차를 볼 수 있다');
  perform pg_temp.expect_count('anon', format('select count(*) from public.public_rounds where round_id = %L and round_name = ''테스트회차''', r1), 1, 'O7 공개된 회차의 이름이 보인다');
  perform pg_temp.expect_count('anon', 'select count(*) from public.public_estimates', 2, 'O8 공개되면 기관 종별 추정치(응답 5곳 이상 구간)가 보인다');
  perform pg_temp.expect_count('anon',
    'select count(*) from public.public_participation where submitted_count = 2 and total_institution_count = 100 and participation_rate_pct = 2.0',
    1, 'O9 참여 기관 수와 참여율(2 ÷ 100 = 2.0%)이 보인다');

  -- 개별 기관 정보는 어떤 공개용 조회에도 없고, 표는 계속 닫혀 있다
  perform pg_temp.expect_fail('anon', 'select institution_id from public.public_estimates', 'O10 공개용 추정치에는 기관 id 칸이 없다');
  perform pg_temp.expect_fail('anon', 'select institution_id from public.public_participation', 'O11 공개용 참여 현황에는 기관 id 칸이 없다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.estimates', 'O12 추정치 표는 로그인하지 않은 사람에게 닫혀 있다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.submissions', 'O13 조사 자료 표는 닫혀 있다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.institution_indicators', 'O14 기관별 지표 표는 닫혀 있다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.comments', 'O15 코멘트 표는 닫혀 있다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.institution_comments', 'O16 의료기관용 코멘트 조회도 로그인하지 않으면 닫혀 있다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.publish_log', 'O17 변경 이력은 닫혀 있다');

  -- 기준(5곳 미만 숨김)을 올리면 공개용 추정치에서도 숨겨진다
  perform pg_temp.expect_count(admin_id::text,
    'with x as (update public.app_settings set value = ''8''::jsonb where key = ''min_group_size'' returning 1) select count(*) from x',
    1, 'O18 관리자는 숨김 기준을 바꿀 수 있다');
  perform pg_temp.expect_count('anon', 'select count(*) from public.public_estimates', 0, 'O19 표본 수가 기준 미만이면 공개용 추정치에서도 숨겨진다');
  update public.app_settings set value = '5'::jsonb where key = 'min_group_size';

  -- 공개를 철회하면 모든 공개용 조회에서 즉시 사라진다
  perform pg_temp.expect_count(admin_id::text,
    format('with x as (update public.round_results set status = ''withdrawn'', status_reason = ''공개용 조회 철회 시험'' where round_id = %L returning 1) select count(*) from x', r1),
    1, 'O20 공개 → 철회됨');
  perform pg_temp.expect_count('anon', 'select count(*) from public.public_rounds', 0, 'O21 철회하면 회차가 즉시 보이지 않는다');
  perform pg_temp.expect_count('anon', 'select count(*) from public.public_estimates', 0, 'O22 철회하면 추정치가 즉시 보이지 않는다');
  perform pg_temp.expect_count('anon', 'select count(*) from public.public_participation', 0, 'O23 철회하면 참여 현황이 즉시 보이지 않는다');

  -- ===== P. 가입 승인 처리 (종별 지정, 기관당 1명, 교체 승인, 이력) =====
  insert into public.institutions (id, name, ykiho_code) values (i6, '승인 시험 병원', 'RLS-T6');
  insert into auth.users (id, email) values (u6, 'rls-u6@test.invalid'), (u7, 'rls-u7@test.invalid');
  insert into public.profiles (id, name, email, role, institution_id, requested_institution_name) values
    (u6, '신청자6', 'rls-u6@test.invalid', 'institution', i6, '승인 시험 병원'),
    (u7, '신청자7', 'rls-u7@test.invalid', 'institution', i6, '승인 시험 병원(새 담당)');

  perform pg_temp.expect_fail(sur_id::text, format('select public.review_signup(%L, ''approve'', ''병원'')', u6), 'P1 조사관은 가입을 처리할 수 없다');
  perform pg_temp.expect_fail(u1::text, format('select public.review_signup(%L, ''approve'', ''병원'')', u6), 'P2 의료기관은 가입을 처리할 수 없다');
  perform pg_temp.expect_fail('anon', format('select public.review_signup(%L, ''approve'', ''병원'')', u6), 'P3 로그인하지 않으면 가입을 처리할 수 없다');
  perform pg_temp.expect_fail(admin_id::text, format('select public.review_signup(%L, ''approve'')', u6), 'P4 기관 종별이 없으면 승인할 수 없다');
  perform pg_temp.expect_fail(admin_id::text, format('select public.review_signup(%L, ''approve'', ''없는 종별'')', u6), 'P5 등록되지 않은 종별로는 승인할 수 없다');
  perform pg_temp.expect_fail(admin_id::text, format('select public.review_signup(%L, ''엉뚱한 처리'', ''병원'')', u6), 'P6 알 수 없는 처리는 거부된다');
  perform pg_temp.expect_fail(admin_id::text, format('select public.review_signup(%L, ''approve'', ''병원'')', sur_id), 'P7 의료기관 가입 신청이 아닌 계정은 처리할 수 없다');
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from (select public.review_signup(%L, ''approve'', ''병원'')) x', u6),
    1, 'P8 종별을 지정하면서 승인할 수 있다');
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.profiles p join public.institutions i on i.id = p.institution_id where p.id = %L and p.approval_status = ''approved'' and i.institution_type = ''병원''', u6),
    1, 'P9 승인되고 기관 종별이 저장된다');
  perform pg_temp.expect_fail(admin_id::text, format('select public.review_signup(%L, ''approve'')', u7), 'P10 이미 승인된 담당자가 있으면 일반 승인은 거부된다');
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from (select public.review_signup(%L, ''replace'')) x', u7),
    1, 'P11 교체 승인을 할 수 있다');
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.profiles where (id = %L and approval_status = ''rejected'') or (id = %L and approval_status = ''approved'')', u6, u7),
    2, 'P12 교체 승인하면 기존 담당자는 거절되고 새 담당자가 승인된다');
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from (select public.review_signup(%L, ''reject'')) x', u7),
    1, 'P13 거절할 수 있다');
  perform pg_temp.expect_count('owner', format('select count(*) from public.profiles where id = %L and approval_status = ''rejected''', u7), 1, 'P14 거절되면 상태가 거절이 된다');
  perform pg_temp.expect_count('owner',
    format('select count(*) from public.profiles where id = %L and requested_institution_name = ''승인 시험 병원''', u6),
    1, 'P15 가입 때 입력한 기관명이 남는다');

  -- 이력
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from public.account_history where profile_id = %L and from_status is null and to_status = ''pending''', u6),
    1, 'P16 가입 신청이 이력에 남는다');
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from public.account_history where profile_id = %L and to_status = ''approved'' and performed_by = %L', u6, admin_id),
    1, 'P17 승인이 수행한 관리자와 함께 이력에 남는다');
  perform pg_temp.expect_count(admin_id::text,
    format('select count(*) from public.account_history where profile_id = %L and from_status = ''approved'' and to_status = ''rejected'' and performed_by = %L', u6, admin_id),
    1, 'P18 교체로 거절된 기존 담당자도 이력에 남는다');
  perform pg_temp.expect_count(u1::text, 'select count(*) from public.account_history', 0, 'P19 의료기관은 계정 이력을 볼 수 없다');
  perform pg_temp.expect_fail('anon', 'select count(*) from public.account_history', 'P20 로그인하지 않으면 계정 이력을 볼 수 없다');
  perform pg_temp.expect_fail(admin_id::text, 'delete from public.account_history', 'P21 계정 이력은 지울 수 없다');

  -- 모든 확인을 통과하면 일부러 오류를 내어, 만든 임시 자료를 전부 되돌린다
  raise exception 'RLS_CHECK_PASSED';
end $$;
