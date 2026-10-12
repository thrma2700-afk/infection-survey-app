// 새 비밀번호 입력 화면. 이메일의 재설정 링크(/auth/callback)를 거쳐 로그인 정보가 생긴 사용자만 볼 수 있다.
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "@/components/auth-forms";
import { createUserClient } from "@/lib/supabase/server";

async function ResetGate() {
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/forgot-password");
  }
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="새 비밀번호 정하기">
      <Suspense fallback={<p className="text-center text-sm">불러오는 중…</p>}>
        <ResetGate />
      </Suspense>
    </AuthCard>
  );
}
