// 저장소(Supabase) 연결 확인 도구. `npm run check:db`로 실행한다.
// 연결 정보는 .env.local에서 읽고, 키 값은 화면에 출력하지 않는다.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const results = [];

function record(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1) 환경 변수가 모두 있는지 (이름만 확인, 값은 출력하지 않음)
const envNames = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SECRET_KEY: secretKey,
};
for (const [name, value] of Object.entries(envNames)) {
  record(`환경 변수 ${name}`, Boolean(value), value ? "값 있음" : "값 없음");
}

if (!url || !publishableKey || !secretKey) {
  console.log("\n환경 변수가 비어 있어 연결 확인을 중단합니다. .env.local을 확인하세요.");
  process.exit(1);
}

// 2) 서버(로그인 담당)가 응답하는지
try {
  const res = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: publishableKey },
  });
  record("로그인 서버 응답", res.ok, `HTTP ${res.status}`);
} catch (error) {
  record("로그인 서버 응답", false, error.message);
}

// 3) 공개 키로 데이터 서버에 닿는지 / 4) 비밀 키로 닿는지
// 아직 표를 만들기 전이라, 없는 표를 조회해 "표가 없다"는 응답이 오면 연결이 된 것으로 본다.
for (const [label, key] of [
  ["공개 키", publishableKey],
  ["비밀 키", secretKey],
]) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.from("_connection_check").select("*").limit(1);
  // PGRST205: 표를 찾지 못함 = 데이터 서버까지 도달했고 키도 받아들여짐
  const reached = !error || error.code === "PGRST205";
  record(`데이터 서버 연결 (${label})`, reached, reached ? "연결됨" : error.message);
}

const failed = results.filter((ok) => !ok).length;
console.log(failed === 0 ? "\n모든 확인을 통과했습니다." : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
