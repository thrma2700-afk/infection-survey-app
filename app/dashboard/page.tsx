// 의료기관 첫 화면 (Design Ref: §2.2 /dashboard). 내용은 이후 작업에서 채운다.
import { ComingSoon, PageHeader } from "@/components/page-header";
import { RolePage } from "@/components/role-page";

export default function DashboardHome() {
  return (
    <RolePage role="institution">
      <PageHeader title="대시보드" description="우리 기관의 조사 결과와 관리자 코멘트를 확인합니다." />
      <ComingSoon>공개된 결과와 우리 기관의 조사 결과가 이곳에 표시됩니다. (준비 중)</ComingSoon>
    </RolePage>
  );
}
