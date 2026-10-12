// 관리자 첫 화면 (Design Ref: §2.2 /admin). 내용은 이후 작업에서 채운다.
import { ComingSoon, PageHeader } from "@/components/page-header";
import { RolePage } from "@/components/role-page";

export default function AdminHome() {
  return (
    <RolePage role="admin">
      <PageHeader title="관리 홈" description="오늘 처리할 일과 조사 진행 상황을 한눈에 봅니다." />
      <ComingSoon>오픈된 회차, 제출 현황, 승인 대기 건수가 이곳에 표시됩니다. (준비 중)</ComingSoon>
    </RolePage>
  );
}
