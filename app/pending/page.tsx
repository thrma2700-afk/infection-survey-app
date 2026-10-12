// 승인 대기 안내 화면 (Design Ref: §2.2 /pending). 승인 전(대기·거절) 계정은 다른 화면을 볼 수 없다.
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { logout } from "@/lib/auth/actions";
import { getSessionProfile } from "@/lib/auth/session";
import { roleHomes } from "@/lib/menu";
import { ui } from "@/lib/ui";

async function PendingContent() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.approvalStatus === "approved") {
    redirect(roleHomes[profile.role]);
  }

  const rejected = profile.approvalStatus === "rejected";
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span
        aria-hidden="true"
        className={`inline-flex size-12 items-center justify-center rounded-full text-xl ${
          rejected ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary"
        }`}
      >
        {rejected ? "!" : "…"}
      </span>
      <p className="text-sm">
        {rejected
          ? "가입이 승인되지 않았습니다. 자세한 내용은 담당 관리자에게 문의해 주세요."
          : "관리자 승인 후 이용할 수 있습니다. 승인이 끝나면 다시 로그인해 주세요."}
      </p>
      <form action={logout}>
        <button type="submit" className={ui.buttonSecondary}>
          로그아웃
        </button>
      </form>
    </div>
  );
}

export default function PendingPage() {
  return (
    <AuthCard title={"승인 대기"}>
      <Suspense fallback={<p className="text-center text-sm text-muted">불러오는 중…</p>}>
        <PendingContent />
      </Suspense>
    </AuthCard>
  );
}
