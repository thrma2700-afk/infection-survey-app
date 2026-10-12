// 로그인 없이 보이는 첫 화면 확인 도구. `npm run check:public`으로 실행한다. (앱 서버가 켜져 있어야 한다)
// 확인하는 것: 첫 화면의 안내 내용, 공표 내역(없을 때의 안내 포함), 로그인하지 않은 사람이 읽을 수 있는 저장소 범위
// (공개용 조회 3개만 열려 있고, 표 원본과 기관별 정보는 닫혀 있는지).
// 공표된 자료를 새로 만들어 시험하지 않는다. (공표된 결과는 누구나 볼 수 있으므로 시험 자료를 실제 저장소에 남기지 않는다.
// 공표·철회가 공개용 조회에 즉시 반영되는지는 점검 도구 check:schema의 시험이 되돌릴 수 있는 방식으로 확인한다.)
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let failed = 0;
function report(ok, name, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

if (!url || !publishableKey) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 필요합니다.");
  process.exit(1);
}

// ===== 1. 첫 화면 =====
let page;
try {
  page = await fetch(BASE_URL, { redirect: "manual" });
} catch {
  console.log(`❌ ${BASE_URL}에 접속할 수 없습니다. 앱 서버를 먼저 켜 주세요. (npm run dev)`);
  process.exit(1);
}
const html = await page.text();
// 화면에 보이는 글자만 비교하기 쉽게 태그를 걷어낸다
const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

report(page.status === 200, "첫 화면이 로그인 없이 열린다", `HTTP ${page.status}`);
report(text.includes("의료기관의 감염관리 현황에 대한 실태조사"), "실태조사 정의가 보인다");
report(text.includes("감염병예방법 제17조"), "개요(법적 근거, 3년 주기)가 보인다");
for (const label of ["조사 대상", "조사 방법", "조사 내용", "조사 주기"]) {
  report(text.includes(label), `주요내용 '${label}'이 보인다`);
}
report(text.includes("2024년") && text.includes("2026년") && text.includes("의원"), "조사 주기별 일정표가 보인다");
const reportLinks = [...html.matchAll(/href="(https:\/\/www\.kdca\.go\.kr\/[^"]+)"/g)].map((m) => m[1]);
report(reportLinks.filter((l) => /download/.test(l)).length >= 4, "주요결과(질병관리청 보고서 2021~2024년) 링크 4개가 있다");
report(text.includes("회차별 공표 내역"), "회차별 공표 내역 구역이 보인다");
report(
  text.includes("아직 공표된 결과가 없습니다") || /공표일/.test(text),
  "공표 내역이 있거나, 없으면 안내 문구가 보인다",
);
report(/href="\/login"/.test(html), "로그인 버튼이 있다 (권한이 필요한 내용을 볼 때 로그인)");
report(!/로그인 후|센터/.test(text), "첫 화면이 센터로 나뉘어 있지 않다(화면 하나)");
report(
  reportLinks.every((l) => /\/sites\/kdca\/download\/|\/bbs\/kdca\/\d+\/\d+\/download\.do|\/kdca\/3352\/subview\.do/.test(l)),
  "외부 링크는 질병관리청 주소뿐이다",
);
report(
  [...html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)].every((m) => /rel="noopener noreferrer"/.test(m[0])),
  "새 창으로 열리는 링크는 모두 noopener noreferrer",
);

// ===== 2. 로그인하지 않은 사람이 저장소에서 읽을 수 있는 것 =====
async function anonGet(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

for (const view of ["public_rounds", "public_participation", "public_estimates"]) {
  const r = await anonGet(`${view}?select=*&limit=1`);
  report(r.status === 200 && Array.isArray(r.body), `공개용 조회 ${view}은 로그인 없이 읽힌다`, `HTTP ${r.status}`);
}

for (const table of [
  "institutions",
  "profiles",
  "rounds",
  "round_results",
  "estimates",
  "institution_indicators",
  "comments",
  "submissions",
  "publish_log",
  "reference_stats",
  "institution_comments",
  "institution_round_results",
  "round_metrics",
]) {
  const r = await anonGet(`${table}?select=*&limit=1`);
  const readable = r.status === 200 && Array.isArray(r.body) && r.body.length > 0;
  const blocked = r.status >= 400 || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0);
  report(!readable && blocked, `${table}은(는) 로그인하지 않은 사람에게 닫혀 있다`, `HTTP ${r.status}`);
}

// 공개용 조회에는 기관을 알 수 있는 칸이 없다
for (const [view, column] of [
  ["public_estimates", "institution_id"],
  ["public_participation", "institution_id"],
  ["public_rounds", "created_by"],
]) {
  const r = await anonGet(`${view}?select=${column}&limit=1`);
  report(r.status >= 400, `공개용 조회 ${view}에는 ${column} 칸이 없다`, `HTTP ${r.status}`);
}

console.log(failed === 0 ? "\n모든 확인을 통과했습니다." : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
