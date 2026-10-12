// Design Ref: §2.2 화면 목록 — 역할별 메뉴. 화면을 만들 때마다 해당 항목의 ready를 true로 바꾼다.

export type Role = "surveyor" | "admin" | "institution";

export const roleLabels: Record<Role, string> = {
  surveyor: "조사관",
  admin: "관리자",
  institution: "의료기관",
};

/** 로그인한 뒤 역할별로 처음 보여 주는 화면 */
export const roleHomes: Record<Role, string> = {
  surveyor: "/surveyor",
  admin: "/admin",
  institution: "/dashboard",
};

export type MenuItem = {
  label: string;
  href: string;
  /** 화면이 만들어졌으면 true. false이면 "준비 중"으로 표시하고 눌러지지 않는다. */
  ready: boolean;
};

export const menusByRole: Record<Role, MenuItem[]> = {
  surveyor: [{ label: "내 조사 목록", href: "/surveyor", ready: true }],
  admin: [
    { label: "관리 홈", href: "/admin", ready: true },
    { label: "회차 관리", href: "/admin/rounds", ready: false },
    { label: "기관·배정 관리", href: "/admin/institutions", ready: false },
    { label: "가입 승인", href: "/admin/signups", ready: true },
    { label: "제출 점검", href: "/admin/submissions", ready: false },
    { label: "결과 관리", href: "/admin/results", ready: false },
  ],
  institution: [{ label: "대시보드", href: "/dashboard", ready: true }],
};

export function isRole(value: string): value is Role {
  return value === "surveyor" || value === "admin" || value === "institution";
}
