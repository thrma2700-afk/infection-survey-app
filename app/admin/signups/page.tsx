// 관리자: 가입 승인 화면 (Design Ref: §2.2 /admin/signups)
// 의료기관 가입 신청을 확인하고 승인·교체 승인·거절한다. 기관 종별을 지정해야 승인할 수 있고, 한 기관에는 승인된 담당자가 1명이다.
import { PageHeader } from "@/components/page-header";
import { RolePage } from "@/components/role-page";
import { ApplicationCard, ContactRow } from "@/components/signup-review";
import { getSignupReviewData } from "@/lib/admin/signups";
import { ui } from "@/lib/ui";

async function SignupReview() {
  const data = await getSignupReviewData();

  if (!data.ok) {
    return (
      <p role="alert" className={ui.noticeError}>
        가입 신청을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="pending" className="flex flex-col gap-4">
        <h2 id="pending" className="flex items-center gap-2 text-xl font-bold">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-accent" />
          승인 대기 ({data.applications.length}건)
        </h2>
        {data.applications.length === 0 ? (
          <p className={ui.emptyBox}>
            승인을 기다리는 가입 신청이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {data.applications.map((application) => (
              <ApplicationCard
                key={application.profileId}
                application={application}
                institutionTypes={data.institutionTypes}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="approved" className="flex flex-col gap-4">
        <h2 id="approved" className="flex items-center gap-2 text-xl font-bold">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-accent" />
          승인된 담당자 ({data.contacts.length}명)
        </h2>
        {data.contacts.length === 0 ? (
          <p className={ui.emptyBox}>승인된 의료기관 담당자가 없습니다.</p>
        ) : (
          <div className={ui.tableWrap}>
            <table className="w-full min-w-[36rem] border-collapse bg-background">
              <caption className="sr-only">승인된 의료기관 담당자</caption>
              <thead>
                <tr>
                  <th className={ui.th}>이름</th>
                  <th className={ui.th}>이메일</th>
                  <th className={ui.th}>기관</th>
                  <th className={ui.th}>처리</th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map((contact) => (
                  <ContactRow key={contact.profileId} contact={contact} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminSignupsPage() {
  return (
    <RolePage role="admin">
      <PageHeader
        title="가입 승인"
        description="의료기관 담당자의 가입 신청을 처리합니다. 기관 종별이 지정되어야 승인할 수 있고, 한 기관에는 승인된 담당자가 1명입니다. 모든 처리는 이력으로 남습니다."
      />
      <SignupReview />
    </RolePage>
  );
}
