// 관리자의 가입 승인 화면에 필요한 자료를 읽는다. 관리자 본인의 로그인 정보로 읽으므로 저장소의 접근 규칙이 그대로 적용된다.
import "server-only";

import { requireRole } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";

export type SignupApplication = {
  profileId: string;
  name: string;
  email: string;
  createdAt: string;
  requestedInstitutionName: string | null;
  institution: { id: string; name: string; ykihoCode: string; institutionType: string | null };
  /** 같은 기관에 이미 승인된 담당자 (있으면 교체 승인이 필요하다) */
  currentContact: { name: string; email: string } | null;
};

export type ApprovedContact = {
  profileId: string;
  name: string;
  email: string;
  institutionName: string;
  ykihoCode: string;
};

export type SignupReviewData =
  | { ok: true; applications: SignupApplication[]; contacts: ApprovedContact[]; institutionTypes: string[] }
  | { ok: false };

export async function getSignupReviewData(): Promise<SignupReviewData> {
  // 화면과 별개로 여기서도 관리자인지 확인한다 (자료를 읽는 곳에서 직접 확인)
  await requireRole("admin");
  const supabase = await createUserClient();

  const [pending, approved, types] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, name, email, created_at, requested_institution_name, institution_id, institutions(id, name, ykiho_code, institution_type)",
      )
      .eq("role", "institution")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("profiles")
      .select("id, name, email, institution_id, institutions(name, ykiho_code)")
      .eq("role", "institution")
      .eq("approval_status", "approved")
      .order("created_at", { ascending: true })
      .limit(500),
    supabase.from("institution_types").select("name").order("name").limit(200),
  ]);

  if (pending.error || approved.error || types.error) {
    return { ok: false };
  }

  const contactByInstitution = new Map(
    approved.data.flatMap((row) => (row.institution_id ? [[row.institution_id, row] as const] : [])),
  );

  const applications: SignupApplication[] = pending.data.flatMap((row) => {
    const institution = row.institutions;
    if (!institution) return [];
    const contact = contactByInstitution.get(institution.id);
    return [
      {
        profileId: row.id,
        name: row.name,
        email: row.email,
        createdAt: row.created_at,
        requestedInstitutionName: row.requested_institution_name,
        institution: {
          id: institution.id,
          name: institution.name,
          ykihoCode: institution.ykiho_code,
          institutionType: institution.institution_type,
        },
        currentContact: contact ? { name: contact.name, email: contact.email } : null,
      },
    ];
  });

  const contacts: ApprovedContact[] = approved.data.flatMap((row) =>
    row.institutions
      ? [
          {
            profileId: row.id,
            name: row.name,
            email: row.email,
            institutionName: row.institutions.name,
            ykihoCode: row.institutions.ykiho_code,
          },
        ]
      : [],
  );

  return { ok: true, applications, contacts, institutionTypes: types.data.map((t) => t.name) };
}
