// 데이터 구조·접근 규칙 확인 도구. `npm run check:schema`로 실행한다.
// 1) 필요한 표가 모두 있고 행 단위 접근 규칙(RLS)이 켜져 있는지
// 2) 로그인하지 않은 요청이 표를 읽지 못하는지
// 3) supabase/tests/rls-check.sql로 역할별 노출·차단 규칙을 점검 (임시 자료는 끝나면 모두 되돌려진다)
// 키 값은 화면에 출력하지 않는다.
import { readFile } from "node:fs/promises";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!accessToken || !url || !publishableKey) {
  console.log("❌ 환경 변수(SUPABASE_ACCESS_TOKEN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)가 비어 있습니다.");
  process.exit(1);
}

const projectRef = new URL(url).hostname.split(".")[0];
const expectedTables = [
  "institutions",
  "institution_types",
  "profiles",
  "rounds",
  "round_institutions",
  "submissions",
  "round_results",
  "estimates",
  "institution_indicators",
  "comments",
  "publish_log",
  "submission_history",
  "account_history",
  "reference_stats",
  "app_settings",
];

let failed = 0;
function report(ok, name, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// 데이터베이스에 SQL을 보내 결과를 받는다
async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

// 1) 표와 RLS
{
  const { ok, body } = await runSql(
    "select c.relname as name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'",
  );
  if (!ok || !Array.isArray(body)) {
    report(false, "표 목록 조회", body?.message ?? "조회 실패");
  } else {
    const found = new Map(body.map((row) => [row.name, row.rls]));
    const missing = expectedTables.filter((t) => !found.has(t));
    // 목록에 없는 새 표도 포함해, public 스키마의 모든 표에 RLS가 켜져 있어야 한다
    const noRls = [...found.entries()].filter(([, rls]) => !rls).map(([name]) => name);
    report(missing.length === 0, `필요한 표 ${expectedTables.length}개`, missing.length ? `없음: ${missing.join(", ")}` : "모두 있음");
    report(noRls.length === 0, "모든 표에 행 단위 접근 규칙(RLS) 적용", noRls.length ? `꺼짐: ${noRls.join(", ")}` : "모두 켜짐");
  }
}

// 2) 로그인하지 않은 요청
{
  const res = await fetch(`${url}/rest/v1/institutions?select=id&limit=1`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
  });
  const body = await res.json().catch(() => null);
  const readable = res.ok && Array.isArray(body);
  report(!readable, "로그인하지 않은 요청은 의료기관 표를 읽을 수 없음", `HTTP ${res.status}`);
}

// 3) 역할별 규칙 점검
{
  const sql = await readFile(new URL("../supabase/tests/rls-check.sql", import.meta.url), "utf8");
  const { body } = await runSql(sql);
  const message = String(body?.message ?? "");
  if (message.includes("RLS_CHECK_PASSED")) {
    report(true, "역할별 노출·차단 규칙 점검", "모든 항목 통과 (임시 자료는 되돌려짐)");
  } else {
    const failure = message.match(/FAIL: [^\n]*/)?.[0] ?? message.slice(0, 300) ?? "알 수 없는 오류";
    report(false, "역할별 노출·차단 규칙 점검", failure);
  }
}

console.log(failed === 0 ? "\n모든 확인을 통과했습니다." : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
