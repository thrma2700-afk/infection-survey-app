// 첫 화면 상단의 로그인 버튼. 권한이 필요한 내용을 볼 때만 로그인하는 방식이므로, 이미 로그인한 사람에게는 "내 화면으로" 버튼을 보여 준다.
import Link from "next/link";
import { Suspense } from "react";

import { getSessionProfile } from "@/lib/auth/session";
import { roleHomes } from "@/lib/menu";
import { ui } from "@/lib/ui";

async function AuthLink() {
  const profile = await getSessionProfile();
  if (profile) {
    const href = profile.approvalStatus === "approved" ? roleHomes[profile.role] : "/pending";
    return (
      <Link href={href} className={ui.buttonPrimary}>
        내 화면으로
      </Link>
    );
  }
  return (
    <Link href="/login" className={ui.buttonPrimary}>
      로그인
    </Link>
  );
}

export function HomeAuthLink() {
  return (
    <Suspense
      fallback={
        <Link href="/login" className={ui.buttonPrimary}>
          로그인
        </Link>
      }
    >
      <AuthLink />
    </Suspense>
  );
}
