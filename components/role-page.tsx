// Design Ref: §5 — 보호된 화면의 입구. 역할 확인(requireRole)을 마친 뒤에만 공통 틀과 내용을 보여 준다.
// 로그인 확인은 요청마다 새로 하므로 Suspense 안에서 이루어진다. (Cache Components: 로그인 정보는 정적 화면에 넣을 수 없다)
// 확인은 레이아웃이 아니라 각 화면에서 한다. (레이아웃은 화면 전환 때 다시 실행되지 않을 수 있어 권한 확인을 맡기지 않는다)
import { Suspense, type ReactNode } from "react";

import { requireRole } from "@/lib/auth/session";
import type { Role } from "@/lib/menu";

import { AppShell } from "./app-shell";

async function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const profile = await requireRole(role);
  return (
    <AppShell role={profile.role} userName={profile.name}>
      {children}
    </AppShell>
  );
}

export function RolePage({ role, children }: { role: Role; children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">불러오는 중…</p>}>
      <RoleGate role={role}>{children}</RoleGate>
    </Suspense>
  );
}
