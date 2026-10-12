"use client";

// 메뉴 한 줄. 지금 보고 있는 화면이면 선택된 모양(연한 초록 바탕, 왼쪽 표시 막대)으로 보인다.
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "relative block rounded-lg px-3 py-2.5 text-sm transition-colors " +
        (active
          ? "bg-primary-soft font-medium text-primary before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-full before:bg-accent"
          : "text-foreground hover:bg-surface-strong")
      }
    >
      {label}
    </Link>
  );
}
