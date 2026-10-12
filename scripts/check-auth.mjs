// 로그인·권한 확인 도구. `npm run check:auth`로 실행한다. (앱 서버가 켜져 있어야 한다: npm run dev 또는 npm run start)
// 시험 계정의 비밀번호를 쓰지 않는다. 대신 관리용 일회용 링크로 로그인 상태(쿠키)를 만들어, 실제 요청을 보내 역할별 접근을 확인한다.
// 확인하는 것: 로그인하지 않은 접근 차단, 역할별 첫 화면과 다른 역할 화면 차단, 승인 대기·거절 계정, 변조된 로그인 정보, 가입 설정.
// 임시 계정은 끝나면 모두 지운다. 키·비밀번호는 출력하지 않는다.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!url || !publishableKey || !secretKey) {
  console.log("❌ 환경 변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY)가 필요합니다.");
  process.exit(1);
}

const projectRef = new URL(url).hostname.split(".")[0];
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

let failed = 0;
function report(ok, name, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// 서버가 켜져 있는지
try {
  await fetch(BASE_URL, { redirect: "manual" });
} catch {
  console.log(`❌ ${BASE_URL}에 접속할 수 없습니다. 앱 서버를 먼저 켜 주세요. (npm run dev)`);
  process.exit(1);
}

// 일회용 링크로 로그인 상태(쿠키)를 만든다
async function sessionCookieFor(email) {
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
  const { error: verifyError } = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verifyError) throw verifyError;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

// 요청을 보내 결과를 요약한다. 화면 안에서 일어나는 이동(redirect)도 함께 찾는다.
async function visit(path, cookie) {
  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: cookie ? { Cookie: cookie } : {},
  });
  const location = res.headers.get("location");
  const body = res.status < 300 || res.status >= 400 ? await res.text() : "";
  // 화면을 그리는 중에 이동하는 경우 Next.js가 HTML에 이동 정보를 넣는다
  const inPage = body.match(/NEXT_REDIRECT;(?:replace|push);([^;"\\]+)/)?.[1] ?? null;
  const metaRefresh = body.match(/http-equiv="refresh"[^>]*content="\d+;url=([^"]+)"/)?.[1] ?? null;
  return {
    status: res.status,
    location: location ? new URL(location, BASE_URL).pathname : null,
    redirectsTo: location ? new URL(location, BASE_URL).pathname : (inPage ?? metaRefresh),
    body,
  };
}

const created = [];
async function makeTempUser({ label, role, approval, institutionId, metadata }) {
  const email = `check-auth-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Tmp${Math.random().toString(36).slice(2)}A9x${Date.now()}`,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  created.push(data.user.id);
  if (role) {
    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user.id,
      name: `임시-${label}`,
      email,
      role,
      institution_id: institutionId ?? null,
      approval_status: approval ?? "pending",
    });
    if (profileError) throw profileError;
  }
  return { email, id: data.user.id };
}

try {
  // ===== 1. 로그인하지 않은 접근 =====
  for (const path of ["/admin", "/admin/signups", "/surveyor", "/dashboard", "/pending", "/reset-password"]) {
    const r = await visit(path);
    report(r.status === 307 && r.location === "/login", `로그인 전 ${path} 접근 → 로그인 화면으로 이동`, `HTTP ${r.status}`);
  }
  for (const path of ["/", "/login", "/login/institution", "/login/surveyor", "/login/admin", "/signup", "/forgot-password"]) {
    const r = await visit(path);
    report(r.status === 200, `로그인 전 ${path} 화면은 열림`, `HTTP ${r.status}`);
  }

  // 로그인 종류 선택 화면과 종류별 화면의 내용
  {
    const chooser = await visit("/login");
    report(["/login/institution", "/login/surveyor", "/login/admin"].every((h) => chooser.body.includes(`href="${h}"`)), "로그인 선택 화면에 의료기관용·조사관용·관리자용 입구가 모두 있다");
    for (const [type, label] of [["institution", "의료기관용 로그인"], ["surveyor", "조사관용 로그인"], ["admin", "관리자용 로그인"]]) {
      const r = await visit(`/login/${type}`);
      report(r.body.includes(label) && r.body.includes(`name="type" value="${type}"`), `/login/${type} 화면이 ${label}이고 로그인 종류를 서버로 보낸다`);
    }
    const signupLink = (await visit("/login/institution")).body.includes('href="/signup"');
    const noSignupOnOthers = !(await visit("/login/admin")).body.includes('href="/signup"') && !(await visit("/login/surveyor")).body.includes('href="/signup"');
    report(signupLink && noSignupOnOthers, "회원가입 링크는 의료기관용 로그인에만 있다");
    const bad = await visit("/login/hacker");
    report(bad.status === 404 || /could not be found|404/.test(bad.body), "정해지지 않은 로그인 종류(/login/hacker)는 열리지 않는다", `HTTP ${bad.status}`);
    const signup = await visit("/signup");
    report(["name", "email", "institutionName", "ykiho", "password", "confirm"].every((f) => signup.body.includes(`name="${f}"`)) && !signup.body.includes('name="role"'), "회원가입 화면은 이름·이메일·기관명·요양기관번호·비밀번호만 받고 역할은 받지 않는다");
  }

  // ===== 2. 시험 계정(관리자·조사관·의료기관)의 역할별 접근 =====
  const roleCases = [
    { role: "admin", email: process.env.DEV_ADMIN_EMAIL, home: "/admin", name: "시험 관리자", others: ["/surveyor", "/dashboard"], extraOwn: ["/admin/signups"] },
    { role: "surveyor", email: process.env.DEV_SURVEYOR_EMAIL, home: "/surveyor", name: "시험 조사관", others: ["/admin", "/dashboard", "/admin/signups"] },
    { role: "institution", email: process.env.DEV_INSTITUTION_EMAIL, home: "/dashboard", name: "시험 의료기관 담당자", others: ["/admin", "/surveyor", "/admin/signups"] },
  ];
  for (const c of roleCases) {
    if (!c.email) {
      report(false, `${c.role} 시험 계정`, "DEV_*_EMAIL이 없습니다. npm run seed:dev-users를 먼저 실행하세요.");
      continue;
    }
    const cookie = await sessionCookieFor(c.email);
    const own = await visit(c.home, cookie);
    report(own.status === 200 && own.body.includes(c.name) && !own.redirectsTo, `${c.role}: 자기 첫 화면(${c.home})이 열리고 이름이 보임`, `HTTP ${own.status}`);
    for (const path of c.others) {
      const r = await visit(path, cookie);
      const blocked = r.redirectsTo === c.home && !r.body.includes("준비 중)");
      report(blocked, `${c.role}: 다른 역할 화면 ${path} 접근 차단 → ${c.home}로 이동`, r.redirectsTo ? `이동 ${r.redirectsTo}` : `이동 없음, HTTP ${r.status}`);
    }
    // 관리자 전용 화면(가입 승인)은 관리자에게만 열린다
    for (const path of c.extraOwn ?? []) {
      const r = await visit(path, cookie);
      report(r.status === 200 && r.body.includes("가입 승인") && !r.redirectsTo, `${c.role}: ${path} 화면이 열림`, `HTTP ${r.status}`);
    }
    // 로그인 종류별 화면도 이미 로그인한 사용자는 자기 첫 화면으로 이동한다
    for (const type of ["institution", "surveyor", "admin"]) {
      const r = await visit(`/login/${type}`, cookie);
      report(r.redirectsTo === c.home, `${c.role}: 이미 로그인했으면 /login/${type} 대신 첫 화면으로 이동`, r.redirectsTo ?? "이동 없음");
    }
    const login = await visit("/login", cookie);
    report(login.redirectsTo === c.home, `${c.role}: 이미 로그인했으면 로그인 화면 대신 첫 화면으로 이동`, login.redirectsTo ?? "이동 없음");

    // 로그아웃: 화면의 로그아웃 양식을 그대로 보내 로그인 정보가 지워지는지 확인한다 (관리자 계정으로 한 번만)
    if (c.role === "admin") {
      const actionId = own.body.match(/name="\$ACTION_ID_([0-9a-f]+)"/)?.[1];
      if (!actionId) {
        report(false, "로그아웃 양식을 화면에서 찾지 못함");
      } else {
        // 브라우저가 서버 처리 양식을 보내는 방식(multipart)과 같게 보낸다
        const form = new FormData();
        form.append(`$ACTION_ID_${actionId}`, "");
        const res = await fetch(`${BASE_URL}${c.home}`, {
          method: "POST",
          redirect: "manual",
          headers: { Cookie: cookie },
          body: form,
        });
        const setCookies = res.headers.getSetCookie();
        const cleared = setCookies.some((v) => /^sb-.*auth-token/.test(v) && /(max-age=0|expires=thu, 01 jan 1970)/i.test(v));
        report(
          [302, 303, 307].includes(res.status) && new URL(res.headers.get("location") ?? "", BASE_URL).pathname === "/login" && cleared,
          "로그아웃: 로그인 정보가 지워지고 로그인 화면으로 이동",
          `HTTP ${res.status}`,
        );
      }
    }
  }

  // ===== 3. 승인 대기·거절·프로필 없음·계정 정보 변조 =====
  const { data: inst } = await admin.from("institutions").select("id").eq("ykiho_code", "DEV-0001").single();

  const pendingUser = await makeTempUser({
    label: "pending",
    role: "institution",
    approval: "pending",
    institutionId: inst.id,
    // 로그인 계정의 메타데이터에 관리자라고 적어도 믿지 않는다
    metadata: { role: "admin" },
  });
  const pendingCookie = await sessionCookieFor(pendingUser.email);
  for (const path of ["/dashboard", "/admin", "/surveyor"]) {
    const r = await visit(path, pendingCookie);
    report(r.redirectsTo === "/pending", `승인 대기 계정: ${path} 접근 → 승인 대기 화면으로 이동`, r.redirectsTo ?? "이동 없음");
  }
  const pendingPage = await visit("/pending", pendingCookie);
  report(pendingPage.status === 200 && pendingPage.body.includes("관리자 승인 후 이용할 수 있습니다"), "승인 대기 계정: 승인 대기 안내가 보임");

  await admin.from("profiles").update({ approval_status: "rejected" }).eq("id", pendingUser.id);
  const rejectedPage = await visit("/pending", pendingCookie);
  report(rejectedPage.body.includes("승인되지 않았습니다"), "거절된 계정: 거절 안내가 보임");
  const rejectedAdmin = await visit("/admin", pendingCookie);
  report(rejectedAdmin.redirectsTo === "/pending", "거절된 계정: 관리자 화면 접근 차단");

  const noProfile = await makeTempUser({ label: "noprofile", metadata: { role: "admin" } });
  const noProfileCookie = await sessionCookieFor(noProfile.email);
  const noProfileAdmin = await visit("/admin", noProfileCookie);
  report(noProfileAdmin.redirectsTo === "/login" && !noProfileAdmin.body.includes("관리 홈"), "프로필이 없는 로그인 계정: 관리자 화면 접근 차단");

  // 변조된 로그인 정보
  const forged = await visit("/admin", `sb-${projectRef}-auth-token=base64-${Buffer.from("{\"access_token\":\"x.y.z\"}").toString("base64url")}`);
  report(forged.status === 307 && forged.location === "/login", "변조된 로그인 정보: 관리자 화면 접근 차단", `HTTP ${forged.status}`);

  // ===== 4. 재설정 링크 처리 =====
  const noCode = await visit("/auth/callback");
  report(noCode.status === 307 && noCode.location === "/forgot-password", "재설정 링크: 코드가 없으면 재설정 요청 화면으로");
  const badCode = await visit("/auth/callback?code=not-a-real-code");
  report(badCode.status === 307 && badCode.location === "/forgot-password", "재설정 링크: 잘못된 코드는 재설정 요청 화면으로");
  const evil = await visit("/auth/callback?code=x&next=https://evil.example");
  report(evil.location === "/forgot-password", "재설정 링크: 요청에 담긴 다른 주소로는 이동하지 않음");

  // ===== 5. Supabase 로그인 설정 (읽기만 한다) =====
  if (accessToken) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const cfg = await res.json();
    report(cfg.disable_signup === true, "Supabase: 앱을 거치지 않은 직접 가입이 꺼져 있음");
    report(Number(cfg.password_min_length) >= 10, "Supabase: 비밀번호 최소 길이 10자 이상", `현재 ${cfg.password_min_length}자`);
    report(cfg.external_anonymous_users_enabled === false, "Supabase: 익명 로그인이 꺼져 있음");
    report(
      typeof cfg.uri_allow_list === "string" && cfg.uri_allow_list.length > 0 && !/^\*$|\*\*\*/.test(cfg.uri_allow_list),
      "Supabase: 로그인 후 이동 허용 주소가 지정되어 있음",
    );
  } else {
    console.log("ℹ️ SUPABASE_ACCESS_TOKEN이 없어 Supabase 로그인 설정은 확인하지 못했습니다. (.env 필요)");
  }
} finally {
  // 임시 계정 정리
  for (const id of created) {
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
  }
}

console.log(failed === 0 ? "\n모든 확인을 통과했습니다." : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
