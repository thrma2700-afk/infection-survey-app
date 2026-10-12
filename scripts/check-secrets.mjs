// 비밀 값 유출 점검 도구. `npm run check:secrets`로 실행한다.
// .env, .env.local에 있는 비밀 값이 아래 어디에도 들어 있지 않은지 확인한다.
//   1) git이 추적하는 파일과, 아직 커밋하지 않았지만 제외되지 않은 파일
//   2) 브라우저로 내려가는 빌드 결과(.next/static)
//   3) git 커밋 이력 전체
// 비밀 값은 화면에 출력하지 않는다. 이름과 "발견/없음"만 출력한다.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const secretNames = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_ACCESS_TOKEN",
  "VERCEL_TOKEN",
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  // 개발용 시험 계정의 비밀번호 (npm run seed:dev-users가 .env.local에 저장)
  "DEV_ADMIN_PASSWORD",
  "DEV_SURVEYOR_PASSWORD",
  "DEV_INSTITUTION_PASSWORD",
];

let failed = 0;
function report(ok, name, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// 값이 있는 비밀만 점검한다 (너무 짧은 값은 우연히 겹칠 수 있어 12자 이상만)
const secrets = secretNames
  .map((name) => [name, process.env[name]])
  .filter(([, value]) => typeof value === "string" && value.length >= 12);

const skipped = secretNames.filter((name) => !secrets.some(([n]) => n === name));
if (secrets.length === 0) {
  console.log("❌ 점검할 비밀 값이 없습니다. (.env, .env.local을 --env-file로 읽어야 합니다)");
  process.exit(1);
}
if (skipped.length > 0) {
  console.log(`ℹ️ 값이 없거나 짧아 점검에서 뺀 항목: ${skipped.join(", ")}`);
}

// 1) 추적 중인 파일과 제외되지 않은 새 파일
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.startsWith("external-tools/"));

function contains(path, value) {
  try {
    if (statSync(path).size > 5_000_000) return false;
    return readFileSync(path, "utf8").includes(value);
  } catch {
    return false;
  }
}

for (const [name, value] of secrets) {
  const hits = files.filter((f) => contains(f, value));
  report(hits.length === 0, `${name}: 추적·제출 대상 파일`, hits.length ? `${hits.length}개 파일에서 발견 (${hits.join(", ")})` : "없음");
}

// 2) 브라우저로 내려가는 빌드 결과
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const staticDir = join(".next", "static");
if (existsSync(staticDir)) {
  const bundleFiles = walk(staticDir);
  for (const [name, value] of secrets) {
    const hits = bundleFiles.filter((f) => contains(f, value));
    report(hits.length === 0, `${name}: 브라우저 빌드 결과(.next/static)`, hits.length ? `${hits.length}개 파일에서 발견` : "없음");
  }
} else {
  console.log("ℹ️ .next/static이 없어 브라우저 빌드 결과는 점검하지 못했습니다. (npm run build 후 다시 실행)");
}

// 3) git 커밋 이력 (값을 인자로 넘기므로 이 컴퓨터에서만 실행된다)
for (const [name, value] of secrets) {
  const out = execFileSync("git", ["log", "--all", "--oneline", "-S", value], { encoding: "utf8" }).trim();
  const count = out ? out.split("\n").length : 0;
  report(count === 0, `${name}: 커밋 이력`, count ? `${count}개 커밋에서 발견` : "없음");
}

console.log(failed === 0 ? "\n비밀 값이 노출된 곳이 없습니다." : `\n노출 의심 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
