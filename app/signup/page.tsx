// 의료기관 회원가입 신청 화면. 신청 후 관리자가 승인해야 이용할 수 있다.
import { AuthCard } from "@/components/auth-card";
import { SignupForm } from "@/components/auth-forms";

export default function SignupPage() {
  return (
    <AuthCard
      title="의료기관 회원가입"
      description="소속 의료기관의 담당자 정보를 입력해 가입을 신청해 주세요."
    >
      <SignupForm />
    </AuthCard>
  );
}
