// 의료기관 회원가입 신청을 저장소에 반영한다. (이 파일은 서버 전용 연결을 받아서 쓰며, 다른 파일을 가져오지 않는다.
// 그래서 점검 도구(scripts/check-signup.mjs)가 그대로 불러다 실제 저장소로 시험할 수 있다.)
//
// 지키는 것
//  - 신청자가 보내는 값은 이름·이메일·기관명·요양기관번호·비밀번호뿐이다. 역할(의료기관)과 상태(승인 대기)는 서버가 정한다.
//  - 이미 가입된 이메일이거나 신청이 몰려 만들지 않은 경우에도 "접수됨"으로 같은 결과를 돌려준다.
//    (이메일·요양기관번호가 가입되어 있는지 바깥에서 알아내지 못하게 한다)
//  - 신청이 지나치게 몰리면(시간당 전체, 기관당 승인 대기 수) 새로 만들지 않는다. 계정을 한꺼번에 만들어 저장소를 채우는 것을 막는 최소한의 방어이며,
//    CAPTCHA·접속 횟수 제한은 운영 전에 추가로 필요하다.
import type { SupabaseClient } from "@supabase/supabase-js";

export type SignupInput = {
  name: string;
  email: string;
  institutionName: string;
  ykiho: string;
  password: string;
};

export type SignupLimits = {
  /** 최근 1시간 동안 접수할 수 있는 전체 신청 수 */
  perHour: number;
  /** 한 기관에 동시에 둘 수 있는 승인 대기 신청 수 */
  pendingPerInstitution: number;
};

export const defaultSignupLimits: SignupLimits = { perHour: 20, pendingPerInstitution: 5 };

/** received: 접수됨(실제로 만들었거나, 이미 있거나 제한에 걸려 만들지 않았거나 같은 응답) / busy: 전체 신청이 많아 잠시 뒤 다시 / error: 처리하지 못함 */
export type SignupOutcome = "received" | "busy" | "error";

// 서버 전용 연결(비밀 키)을 받는다. 데이터 형식은 호출하는 쪽의 타입을 따른다.
export async function applyForSignup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  input: SignupInput,
  limits: SignupLimits = defaultSignupLimits,
): Promise<SignupOutcome> {
  // 1) 전체 신청이 몰리는지
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent, error: recentError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "institution")
    .gte("created_at", since);
  if (recentError) return "error";
  if ((recent ?? 0) >= limits.perHour) return "busy";

  // 2) 요양기관번호로 기관을 찾고, 없으면 새로 만든다 (종별은 비워 두고 관리자가 승인할 때 정한다)
  let createdInstitutionId: string | null = null;
  let institutionId: string | null = null;

  const { data: existing, error: findError } = await admin
    .from("institutions")
    .select("id")
    .eq("ykiho_code", input.ykiho)
    .maybeSingle();
  if (findError) return "error";

  if (existing) {
    institutionId = existing.id;
  } else {
    const { data: created, error: createError } = await admin
      .from("institutions")
      .insert({ name: input.institutionName, ykiho_code: input.ykiho })
      .select("id")
      .single();
    if (createError || !created) {
      // 동시에 같은 번호로 신청이 들어와 먼저 만들어졌을 수 있다
      const { data: retry } = await admin.from("institutions").select("id").eq("ykiho_code", input.ykiho).maybeSingle();
      if (!retry) return "error";
      institutionId = retry.id;
    } else {
      institutionId = created.id;
      createdInstitutionId = created.id;
    }
  }

  // 3) 한 기관에 승인 대기가 너무 많으면 만들지 않는다 (같은 응답)
  if (!createdInstitutionId) {
    const { count: pending } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("approval_status", "pending");
    if ((pending ?? 0) >= limits.pendingPerInstitution) return "received";
  }

  // 4) 로그인 계정 만들기. 이미 가입된 이메일이면 만들지 않고 같은 응답을 돌려준다.
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (userError || !userData.user) {
    if (createdInstitutionId) {
      await admin.from("institutions").delete().eq("id", createdInstitutionId);
    }
    // 가입 여부를 구분해 알려 주지 않는다. (원인은 서버 기록으로만 남긴다: 이메일 등 개인정보는 기록하지 않는다)
    console.error("signup: 계정을 만들지 못했습니다", userError?.status ?? "", userError?.code ?? "");
    return "received";
  }

  // 5) 프로필: 역할과 상태는 서버가 고정한다
  const { error: profileError } = await admin.from("profiles").insert({
    id: userData.user.id,
    name: input.name,
    email: input.email,
    role: "institution",
    institution_id: institutionId,
    approval_status: "pending",
    requested_institution_name: input.institutionName,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userData.user.id);
    if (createdInstitutionId) {
      await admin.from("institutions").delete().eq("id", createdInstitutionId);
    }
    console.error("signup: 프로필을 만들지 못했습니다", profileError.code ?? "");
    return "error";
  }

  return "received";
}
