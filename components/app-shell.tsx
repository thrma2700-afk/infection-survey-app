// Design Ref: §2.1 공통 틀 — 왼쪽 메뉴(메신저 형태) + 상단 바(이름·역할, 로그아웃) + 본문 영역.
// 모바일에서는 메뉴가 상단의 "메뉴" 버튼 안으로 접힌다. (별도 자바스크립트 없이 <details>로 동작)
import type { ReactNode } from "react";

import { logout } from "@/lib/auth/actions";
import { type Role, menusByRole, roleLabels } from "@/lib/menu";
import { ui } from "@/lib/ui";

import { Brand } from "./brand";
import { NavLink } from "./nav-link";

function Nav({ role }: { role: Role }) {
  return (
    <nav aria-label={`${roleLabels[role]} 메뉴`}>
      <ul className="flex flex-col gap-1">
        {menusByRole[role].map((item) => (
          <li key={item.href}>
            {item.ready ? (
              <NavLink href={item.href} label={item.label} />
            ) : (
              <span
                aria-disabled="true"
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted"
              >
                {item.label}
                <span className={ui.badgeMuted}>준비 중</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
    >
      {name.trim().slice(0, 1) || "?"}
    </span>
  );
}

export function AppShell({
  role,
  userName,
  children,
}: {
  role: Role;
  userName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* PC: 왼쪽 고정 메뉴 */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex h-16 items-center border-b border-border px-4">
          <Brand href={role === "admin" ? "/admin" : role === "surveyor" ? "/surveyor" : "/dashboard"} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Nav role={role} />
        </div>
        <div className="flex items-center gap-3 border-t border-border p-4">
          <Avatar name={userName} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted">{roleLabels[role]}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            {/* 모바일: 메뉴 접기 */}
            <details className="relative md:hidden">
              <summary className="flex shrink-0 cursor-pointer list-none items-center whitespace-nowrap rounded-md border border-border-strong px-3 py-1.5 text-sm">
                메뉴
              </summary>
              <div className="absolute left-0 top-full z-20 mt-2 w-60 rounded-xl border border-border bg-background p-2 shadow-lg">
                <Nav role={role} />
              </div>
            </details>
            <span className="min-w-0 text-sm font-bold leading-tight md:hidden">감염관리 실태조사 관리 시스템</span>
            <span className="hidden md:block">
              <span className={ui.badge}>{roleLabels[role]}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm sm:inline">
              {userName} · {roleLabels[role]}
            </span>
            <form action={logout}>
              <button type="submit" className={ui.buttonSecondary + " whitespace-nowrap !px-3 !py-1.5"}>
                로그아웃
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
