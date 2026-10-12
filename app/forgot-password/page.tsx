// 비밀번호 재설정 안내 요청 화면
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "@/components/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="비밀번호 재설정"
      description="가입한 이메일을 입력하면 재설정 안내를 보내 드립니다."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
