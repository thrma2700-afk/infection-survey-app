// 개발용 시험 계정 준비 도구. `npm run seed:dev-users`로 실행한다.
//   조사관·관리자·의료기관 역할의 시험 계정 3개와 시험용 기관 1개를 만든다. (최초 관리자 포함)
//   비밀번호는 무작위로 만들어 .env.local의 DEV_* 항목에 저장하고, 화면에는 출력하지 않는다.
//   이미 있는 계정은 건드리지 않는다. 비밀번호를 새로 만들려면 `--reset-passwords`, 시험 계정을 지우려면 `--remove`.
// 주의: 실제 운영을 시작하기 전에 `npm run seed:dev-users -- --remove`로 이 시험 계정들을 지운다.
import { randomInt } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY가 필요합니다. (.env.local)");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const resetPasswords = args.has("--reset-passwords");
const removeAll = args.has("--remove");

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const ENV_FILE = ".env.local";
const accounts = [
  { key: "ADMIN", role: "admin", email: "dev-admin@example.com", name: "시험 관리자" },
  { key: "SURVEYOR", role: "surveyor", email: "dev-surveyor@example.com", name: "시험 조사관" },
  { key: "INSTITUTION", role: "institution", email: "dev-institution@example.com", name: "시험 의료기관 담당자" },
];
const TYPE_NAME = "시험종별";
const INSTITUTION = { name: "시험병원", ykiho_code: "DEV-0001" };

// 비밀번호 정책(10자 이상, 영문자와 숫자 포함)을 지키는 무작위 비밀번호
function makePassword() {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = lower + upper + digits;
  const pick = (set) => set[randomInt(set.length)];
  const chars = [pick(lower), pick(upper), pick(digits)];
  while (chars.length < 20) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// .env.local의 해당 항목을 바꾸거나 추가한다 (값은 출력하지 않는다)
function saveEnv(entries) {
  let text = "";
  try {
    text = readFileSync(ENV_FILE, "utf8");
  } catch {
    text = "";
  }
  const lines = text.split(/\r?\n/);
  for (const [name, value] of Object.entries(entries)) {
    const index = lines.findIndex((line) => line.startsWith(`${name}=`));
    const line = `${name}=${value}`;
    if (index >= 0) lines[index] = line;
    else lines.push(line);
  }
  writeFileSync(ENV_FILE, lines.filter((l, i, arr) => l !== "" || i < arr.length - 1).join("\n") + "\n");
}

function removeEnv(names) {
  const text = readFileSync(ENV_FILE, "utf8");
  const kept = text.split(/\r?\n/).filter((line) => !names.some((n) => line.startsWith(`${n}=`)));
  writeFileSync(ENV_FILE, kept.join("\n").replace(/\n+$/, "") + "\n");
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

if (removeAll) {
  for (const account of accounts) {
    const user = await findUserByEmail(account.email);
    if (!user) {
      console.log(`- ${account.email}: 없음`);
      continue;
    }
    await admin.from("profiles").delete().eq("id", user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    console.log(`${error ? "❌" : "✅"} ${account.email}: ${error ? error.message : "삭제함"}`);
  }
  await admin.from("institutions").delete().eq("ykiho_code", INSTITUTION.ykiho_code);
  await admin.from("institution_types").delete().eq("name", TYPE_NAME);
  removeEnv(accounts.flatMap((a) => [`DEV_${a.key}_EMAIL`, `DEV_${a.key}_PASSWORD`]));
  console.log("시험 계정과 시험 기관을 정리했습니다.");
  process.exit(0);
}

// 시험용 기관 종별과 기관 (의료기관 담당자 승인에는 종별이 필요하다)
{
  const { error: typeError } = await admin.from("institution_types").upsert({ name: TYPE_NAME });
  if (typeError) throw typeError;
  const { error: instError } = await admin
    .from("institutions")
    .upsert({ ...INSTITUTION, institution_type: TYPE_NAME }, { onConflict: "ykiho_code" });
  if (instError) throw instError;
}
const { data: institution } = await admin.from("institutions").select("id").eq("ykiho_code", INSTITUTION.ykiho_code).single();

const envEntries = {};
for (const account of accounts) {
  let user = await findUserByEmail(account.email);
  let password = null;

  if (!user) {
    password = makePassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log(`✅ ${account.email}: 계정 만듦`);
  } else if (resetPasswords) {
    password = makePassword();
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
    console.log(`✅ ${account.email}: 비밀번호 새로 만듦`);
  } else {
    console.log(`- ${account.email}: 이미 있음`);
  }

  // 역할과 승인 상태는 이 표에서만 정한다 (로그인 계정의 메타데이터는 믿지 않는다)
  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    name: account.name,
    email: account.email,
    role: account.role,
    institution_id: account.role === "institution" ? institution.id : null,
    approval_status: "approved",
  });
  if (profileError) throw profileError;

  envEntries[`DEV_${account.key}_EMAIL`] = account.email;
  if (password) envEntries[`DEV_${account.key}_PASSWORD`] = password;
}

saveEnv(envEntries);
console.log("\n시험 계정의 이메일과 비밀번호는 .env.local의 DEV_* 항목에 있습니다. (화면에는 출력하지 않았습니다)");
