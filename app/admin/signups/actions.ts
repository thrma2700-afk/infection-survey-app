"use server";

// 관리자의 가입 신청 처리(승인·교체 승인·거절). 외부에서 직접 호출될 수 있는 입구이므로 맨 먼저 관리자인지 확인한다.
import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/auth/actions";
import { reviewSchema } from "@/lib/auth/schemas";
import { requireRole } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";

export async function reviewSignup(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");

  const typeValue = String(formData.get("institutionType") ?? "").trim();
  const parsed = reviewSchema.safeParse({
    profileId: String(formData.get("profileId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    institutionType: typeValue === "" ? undefined : typeValue,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "요청을 확인해 주세요." };
  }
  const { profileId, decision, institutionType } = parsed.data;

  // 관리자 본인의 로그인 정보로 처리하므로 저장소의 접근 규칙과 상태 규칙이 그대로 적용된다
  const supabase = await createUserClient();

  // 새 종별이면 종별 목록에 먼저 등록한다 (이미 있으면 그대로 둔다)
  if (institutionType && decision !== "reject") {
    const { error: typeError } = await supabase
      .from("institution_types")
      .upsert({ name: institutionType }, { onConflict: "name", ignoreDuplicates: true });
    if (typeError) {
      return { error: "기관 종별을 저장하지 못했습니다." };
    }
  }

  const { error } = await supabase.rpc("review_signup", {
    p_profile: profileId,
    p_decision: decision,
    p_institution_type: institutionType ?? undefined,
  });
  if (error) {
    // 저장소가 한국어로 알려 주는 업무 규칙 안내(예: 이미 승인된 담당자가 있음)만 그대로 보여 주고, 그 밖의 오류는 내용을 숨긴다
    const known = /[가-힣]/.test(error.message) && !/\b(violates|constraint|relation|permission)\b/i.test(error.message);
    return { error: known ? error.message : "처리하지 못했습니다. 잠시 뒤에 다시 시도해 주세요." };
  }

  revalidatePath("/admin/signups");
  const label = decision === "reject" ? "거절" : decision === "replace" ? "교체 승인" : "승인";
  return { message: `${label}했습니다.` };
}
