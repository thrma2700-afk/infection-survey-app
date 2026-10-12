// Design Ref: §5 — 서버 코드 단계의 권한 검사(주된 검사). 페이지·서버 처리는 이 함수들로 "누구인지, 어떤 역할인지"를 먼저 확인한다.
// proxy.ts의 검사는 보조일 뿐이고, 최종 판단은 항상 여기서 한다.
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { type Role, roleHomes } from "@/lib/menu";
import { createUserClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  name: string;
  role: Role;
  approvalStatus: "pending" | "approved" | "rejected";
  institutionId: string | null;
};

/**
 * 지금 로그인한 사용자의 프로필. 로그인하지 않았거나 로그인 정보가 유효하지 않으면 null.
 * 쿠키 값을 믿지 않고 Supabase 인증 서버에 확인(getUser)한 뒤, 본인 프로필을 읽는다.
 * 프로필이 없는 로그인 계정은 승인 대기와 같이 취급한다.
 */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createUserClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return null;
  }

  const { data: row } = await supabase
    .from("profiles")
    .select("id, name, role, approval_status, institution_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    role: row.role,
    approvalStatus: row.approval_status,
    institutionId: row.institution_id,
  };
});

/**
 * 해당 역할의 승인된 사용자만 통과시킨다. 모든 보호된 화면과 서버 처리는 시작할 때 이 함수를 부른다.
 *  - 로그인하지 않음 → 로그인 화면
 *  - 승인되지 않음(대기·거절) → 승인 대기 화면
 *  - 다른 역할 → 그 사용자의 첫 화면 (다른 역할의 화면은 볼 수 없다)
 */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login");
  }
  if (profile.approvalStatus !== "approved") {
    redirect("/pending");
  }
  if (profile.role !== role) {
    redirect(roleHomes[profile.role]);
  }
  return profile;
}
