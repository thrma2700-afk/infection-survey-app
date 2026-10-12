// 조사관 첫 화면 (Design Ref: §2.2 /surveyor). 내용은 이후 작업에서 채운다.
import { ComingSoon, PageHeader } from "@/components/page-header";
import { RolePage } from "@/components/role-page";

export default function SurveyorHome() {
  return (
    <RolePage role="surveyor">
      <PageHeader title="내 조사 목록" description="배정된 의료기관의 조사 자료를 입력하고 제출합니다." />
      <ComingSoon>배정된 회차와 의료기관 목록이 이곳에 표시됩니다. (준비 중)</ComingSoon>
    </RolePage>
  );
}
