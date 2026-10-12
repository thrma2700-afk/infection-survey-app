// 회원가입·로그인 종류 확인 도구. `npm run check:signup`으로 실행한다. (앱 서버는 필요 없다)
// 1) 입력 검증 규칙과 로그인 종류 규칙을 시험한다.
// 2) 실제 저장소에 임시 신청을 넣어 가입 처리(lib/auth/signup-core.ts)를 시험한다: 역할·상태 고정, 중복 이메일, 신청 몰림 제한, 실패 시 정리.
// 시험용 계정·기관은 끝나면 모두 지운다. 비밀번호·키는 출력하지 않는다.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { canLoginAs, isLoginType, loginTypes } from "../lib/auth/login-types.ts";
import { reviewSchema, signupSchema } from "../lib/auth/schemas.ts";
import { applyForSignup } from "../lib/auth/signup-core.ts";

let failed = 0;
function report(ok, name, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ===== 1. 로그인 종류 =====
report(isLoginType("institution") && isLoginType("surveyor") && isLoginType("admin"), "로그인 종류 3가지(의료기관·조사관·관리자)를 인정한다");
report(!isLoginType("root") && !isLoginType("") && !isLoginType(undefined) && !isLoginType("Admin"), "그 밖의 종류는 인정하지 않는다");
{
  const roles = ["institution", "surveyor", "admin"];
  const allowed = [];
  for (const role of roles) for (const type of loginTypes) if (canLoginAs(role, type)) allowed.push(`${role}->${type}`);
  report(
    allowed.length === 3 && allowed.every((pair) => pair.split("->")[0] === pair.split("->")[1]),
    "계정의 역할과 같은 종류의 로그인만 허용한다 (9가지 조합 중 3가지)",
    allowed.join(", "),
  );
}

// ===== 2. 입력 검증 =====
const validInput = {
  name: "홍길동",
  email: "check@example.com",
  institutionName: "시험병원",
  ykiho: "ABC-1234",
  password: "Abcdefghij12",
  confirm: "Abcdefghij12",
};
report(signupSchema.safeParse(validInput).success, "올바른 가입 입력은 통과한다");
const fail = (patch) => !signupSchema.safeParse({ ...validInput, ...patch }).success;
report(fail({ password: "Ab1", confirm: "Ab1" }), "짧은 비밀번호는 거부한다");
report(fail({ password: "abcdefghijkl", confirm: "abcdefghijkl" }), "숫자 없는 비밀번호는 거부한다");
report(fail({ password: "123456789012", confirm: "123456789012" }), "영문자 없는 비밀번호는 거부한다");
report(fail({ confirm: "Different12345" }), "비밀번호 확인이 다르면 거부한다");
report(fail({ email: "not-an-email" }), "이메일 형식이 아니면 거부한다");
report(fail({ name: "   " }), "이름이 비면 거부한다");
report(fail({ name: "가".repeat(51) }), "너무 긴 이름은 거부한다");
report(fail({ institutionName: "" }), "기관명이 비면 거부한다");
report(fail({ ykiho: "ab" }), "너무 짧은 요양기관번호는 거부한다");
report(fail({ ykiho: "A B C 123" }), "공백이 든 요양기관번호는 거부한다");
report(fail({ ykiho: "1234'; drop table x;--" }), "특수문자가 든 요양기관번호는 거부한다");
{
  const parsed = signupSchema.safeParse({ ...validInput, role: "admin", approval_status: "approved" });
  report(parsed.success && !("role" in parsed.data) && !("approval_status" in parsed.data), "신청에 역할·승인 상태를 끼워 보내도 받아들이지 않는다");
}
report(
  !reviewSchema.safeParse({ profileId: "not-a-uuid", decision: "approve" }).success &&
    !reviewSchema.safeParse({ profileId: "11111111-1111-4111-8111-111111111111", decision: "delete" }).success &&
    reviewSchema.safeParse({ profileId: "11111111-1111-4111-8111-111111111111", decision: "replace", institutionType: "병원" }).success,
  "관리자 처리 요청은 올바른 계정 id와 정해진 처리(승인·교체 승인·거절)만 받는다",
);

// ===== 3. 저장소에 반영 (임시 자료) =====
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY가 필요합니다. (.env.local)");
  process.exit(1);
}
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const stamp = Date.now();
const ykihoA = `CHK-${stamp}`;
const ykihoB = `CHK-${stamp}-B`;
const ykihoC = `CHK-${stamp}-C`;
const emails = [];
const makeEmail = (label) => {
  const email = `check-signup-${label}-${stamp}@example.com`;
  emails.push(email);
  return email;
};
const base = { name: "시험 신청자", institutionName: "시험 신청 병원", password: "Abcdefghij12" };
const roomy = { perHour: 1000, pendingPerInstitution: 2 };

async function profileByEmail(email) {
  const { data } = await admin.from("profiles").select("*").eq("email", email).maybeSingle();
  return data;
}
async function institutionCount(ykiho) {
  const { count } = await admin.from("institutions").select("id", { count: "exact", head: true }).eq("ykiho_code", ykiho);
  return count ?? 0;
}
async function authUserExists(email) {
  for (let page = 1; page <= 5; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (data.users.some((u) => u.email === email)) return true;
    if (data.users.length < 200) return false;
  }
  return false;
}

try {
  // S1 정상 신청
  const e1 = makeEmail("1");
  const r1 = await applyForSignup(admin, { ...base, email: e1, ykiho: ykihoA }, roomy);
  const p1 = await profileByEmail(e1);
  report(r1 === "received", "S1 정상 신청이 접수된다", r1);
  report(p1?.role === "institution" && p1?.approval_status === "pending", "S1 역할은 의료기관, 상태는 승인 대기로 만들어진다");
  report(p1?.requested_institution_name === base.institutionName, "S1 신청자가 입력한 기관명이 남는다");
  report(!("password" in (p1 ?? {})) && !JSON.stringify(p1 ?? {}).includes(base.password), "S1 비밀번호가 프로필 표에 저장되지 않는다");
  report(await authUserExists(e1), "S1 로그인 계정이 만들어진다");
  const { data: inst1 } = await admin.from("institutions").select("id, name, institution_type").eq("ykiho_code", ykihoA).single();
  report(inst1?.name === base.institutionName && inst1?.institution_type === null, "S1 새 기관이 만들어지고 종별은 비어 있다(관리자가 승인 때 지정)");
  const { data: hist } = await admin.from("account_history").select("from_status, to_status").eq("profile_id", p1?.id ?? "");
  report(hist?.length === 1 && hist[0].from_status === null && hist[0].to_status === "pending", "S1 가입 신청이 계정 이력에 남는다");

  // S2 같은 요양기관번호의 다른 신청자 → 같은 기관에 연결
  const e2 = makeEmail("2");
  const r2 = await applyForSignup(admin, { ...base, institutionName: "다른 이름의 병원", email: e2, ykiho: ykihoA }, roomy);
  const p2 = await profileByEmail(e2);
  report(r2 === "received" && p2?.institution_id === inst1?.id, "S2 같은 요양기관번호는 기존 기관에 연결된다");
  report((await institutionCount(ykihoA)) === 1, "S2 같은 번호의 기관이 중복으로 만들어지지 않는다");

  // S3 이미 가입된 이메일 → 같은 응답, 새 기관은 남지 않는다
  const r3 = await applyForSignup(admin, { ...base, email: e1, ykiho: ykihoB }, roomy);
  report(r3 === "received", "S3 이미 가입된 이메일도 같은 응답(접수됨)을 돌려준다", r3);
  report((await institutionCount(ykihoB)) === 0, "S3 만들지 않은 신청 때문에 만든 새 기관이 정리된다");
  const { count: sameEmail } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("email", e1);
  report(sameEmail === 1, "S3 같은 이메일의 프로필이 늘어나지 않는다");

  // S4 한 기관의 승인 대기 상한
  const e4 = makeEmail("4");
  const r4 = await applyForSignup(admin, { ...base, email: e4, ykiho: ykihoA }, roomy);
  report(r4 === "received" && (await profileByEmail(e4)) === null && !(await authUserExists(e4)), "S4 한 기관의 승인 대기가 상한(2건)이면 같은 응답을 주되 새로 만들지 않는다");

  // S5 전체 신청 몰림 제한
  const e5 = makeEmail("5");
  const r5 = await applyForSignup(admin, { ...base, email: e5, ykiho: ykihoB }, { perHour: 0, pendingPerInstitution: 5 });
  report(r5 === "busy" && (await profileByEmail(e5)) === null && (await institutionCount(ykihoB)) === 0 && !(await authUserExists(e5)), "S5 전체 신청이 많으면 아무것도 만들지 않고 잠시 뒤 다시 시도하라고 알린다");

  // S6 역할·상태를 끼워 보내도 서버가 고정한다
  const e6 = makeEmail("6");
  const r6 = await applyForSignup(admin, { ...base, email: e6, ykiho: ykihoB, role: "admin", approval_status: "approved", institution_id: inst1?.id }, roomy);
  const p6 = await profileByEmail(e6);
  report(r6 === "received" && p6?.role === "institution" && p6?.approval_status === "pending" && p6?.institution_id !== inst1?.id, "S6 입력에 역할·승인 상태를 끼워도 의료기관·승인 대기로 고정된다");

  // ===== 4. 관리자의 승인·교체 승인 (앱 서버가 켜져 있을 때만) =====
  const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let serverUp = true;
  try {
    await fetch(BASE_URL, { redirect: "manual" });
  } catch {
    serverUp = false;
  }

  // 시험 계정의 일회용 링크로 로그인 상태를 만든다. (비밀번호는 쓰지 않는다)
  async function sessionFor(email) {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    const jar = new Map();
    const client = createServerClient(url, publishableKey, {
      cookieOptions: { sameSite: "lax", path: "/" },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
    const { error: verifyError } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "email" });
    if (verifyError) throw verifyError;
    return { client, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
  }

  if (!serverUp) {
    console.log(`ℹ️ ${BASE_URL}에 앱 서버가 없어 관리자 승인 화면 시험은 건너뜁니다. (npm run dev를 켜고 다시 실행하면 확인합니다)`);
  } else if (!process.env.DEV_ADMIN_EMAIL || !process.env.DEV_INSTITUTION_EMAIL) {
    console.log("ℹ️ 시험 계정(DEV_*)이 없어 관리자 승인 화면 시험은 건너뜁니다. (npm run seed:dev-users)");
  } else {
    const first = makeEmail("review-a");
    const second = makeEmail("review-b");
    await applyForSignup(admin, { ...base, name: "승인시험가", email: first, ykiho: ykihoC, institutionName: "승인 시험 병원" }, roomy);
    await applyForSignup(admin, { ...base, name: "승인시험나", email: second, ykiho: ykihoC, institutionName: "승인 시험 병원" }, roomy);
    const profileA = await profileByEmail(first);
    const profileB = await profileByEmail(second);

    const adminSession = await sessionFor(process.env.DEV_ADMIN_EMAIL);
    const page = async () => (await (await fetch(`${BASE_URL}/admin/signups`, { redirect: "manual", headers: { Cookie: adminSession.cookie } })).text()).replace(/<!-- -->/g, "");

    let html = await page();
    report(html.includes(first) && html.includes(second) && html.includes("승인시험가") && html.includes(ykihoC), "R1 가입 승인 화면에 두 신청의 이름·이메일·요양기관번호가 보인다");
    report(html.includes("신청자가 입력한 기관명") && html.includes("등록된 기관") && html.includes("아직 지정되지 않음"), "R2 입력한 기관명과 등록된 기관, 종별 미지정이 함께 보인다");
    report(html.includes('value="approve"') && !html.includes('value="replace"'), "R3 승인된 담당자가 없는 기관에는 '승인' 버튼만 있다");

    // 관리자 본인의 로그인 정보로 처리한다 (화면의 서버 처리와 같은 방식)
    const noType = await adminSession.client.rpc("review_signup", { p_profile: profileA.id, p_decision: "approve" });
    report(Boolean(noType.error) && (await profileByEmail(first)).approval_status === "pending", "R4 기관 종별 없이는 승인되지 않는다");
    const approve = await adminSession.client.rpc("review_signup", { p_profile: profileA.id, p_decision: "approve", p_institution_type: "시험종별" });
    report(!approve.error && (await profileByEmail(first)).approval_status === "approved", "R5 종별을 지정하면 승인된다");

    html = await page();
    const pendingPart = html.split("승인된 담당자 (")[0];
    report(!pendingPart.includes(first) && html.includes(first), "R6 승인되면 승인 대기 목록에서 사라지고 승인된 담당자 목록에 나타난다");
    report(html.includes('value="replace"') && html.includes("이미 승인된 담당자(승인시험가"), "R7 같은 기관의 다음 신청에는 기존 담당자 안내와 '교체 승인' 버튼이 보인다");

    const plain = await adminSession.client.rpc("review_signup", { p_profile: profileB.id, p_decision: "approve" });
    report(Boolean(plain.error) && /이미 승인된 담당자/.test(plain.error.message), "R8 일반 승인은 이미 승인된 담당자가 있으면 거부되고 안내가 나온다");
    const replace = await adminSession.client.rpc("review_signup", { p_profile: profileB.id, p_decision: "replace" });
    const afterA = await profileByEmail(first);
    const afterB = await profileByEmail(second);
    report(!replace.error && afterA.approval_status === "rejected" && afterB.approval_status === "approved", "R9 교체 승인하면 기존 담당자는 거절되고 새 담당자가 승인된다");

    const { data: history } = await admin.from("account_history").select("profile_id, to_status, performed_by").in("profile_id", [profileA.id, profileB.id]);
    const { data: adminProfile } = await admin.from("profiles").select("id").eq("email", process.env.DEV_ADMIN_EMAIL).single();
    report(
      (history ?? []).filter((h) => h.performed_by === adminProfile.id).length === 3,
      "R10 승인·교체 승인·거절이 수행한 관리자와 함께 이력에 남는다 (3건)",
      `${(history ?? []).length}건 중`,
    );

    // 관리자가 아닌 계정은 같은 처리를 할 수 없다
    const institutionSession = await sessionFor(process.env.DEV_INSTITUTION_EMAIL);
    const denied = await institutionSession.client.rpc("review_signup", { p_profile: profileA.id, p_decision: "approve", p_institution_type: "시험종별" });
    report(Boolean(denied.error) && (await profileByEmail(first)).approval_status === "rejected", "R11 의료기관 계정은 가입 신청을 처리할 수 없다");
    const surveyorSession = process.env.DEV_SURVEYOR_EMAIL ? await sessionFor(process.env.DEV_SURVEYOR_EMAIL) : null;
    if (surveyorSession) {
      const deniedSurveyor = await surveyorSession.client.rpc("review_signup", { p_profile: profileA.id, p_decision: "approve", p_institution_type: "시험종별" });
      report(Boolean(deniedSurveyor.error), "R12 조사관 계정은 가입 신청을 처리할 수 없다");
    }
  }
} finally {
  // 정리: 임시 로그인 계정(프로필·이력은 함께 지워진다)과 임시 기관
  for (const email of emails) {
    for (let page = 1; page <= 5; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const user = data.users.find((u) => u.email === email);
      if (user) {
        await admin.from("profiles").delete().eq("id", user.id);
        await admin.auth.admin.deleteUser(user.id);
        break;
      }
      if (data.users.length < 200) break;
    }
  }
  await admin.from("institutions").delete().in("ykiho_code", [ykihoA, ykihoB, ykihoC]);
  const left = (await institutionCount(ykihoA)) + (await institutionCount(ykihoB)) + (await institutionCount(ykihoC));
  report(left === 0, "시험용 기관이 모두 정리되었다");
}

console.log(failed === 0 ? "\n모든 확인을 통과했습니다." : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
