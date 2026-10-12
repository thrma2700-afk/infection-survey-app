"use client";

// 관리자의 가입 신청 처리 양식. 실제 처리와 권한 확인은 서버 처리(app/admin/signups/actions.ts)가 한다.
import { useActionState } from "react";

import { reviewSignup } from "@/app/admin/signups/actions";
import type { ApprovedContact, SignupApplication } from "@/lib/admin/signups";
import type { FormState } from "@/lib/auth/actions";
import { ui } from "@/lib/ui";

const initialState: FormState = {};
const inputClass = ui.input;
const primaryButton = ui.buttonPrimary;
const secondaryButton = ui.buttonSecondary;

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateFormat.format(date);
}

function sameName(a: string | null, b: string) {
  return (a ?? "").replace(/\s+/g, "") === b.replace(/\s+/g, "");
}

function Result({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className={ui.noticeError}>
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className={ui.noticeSuccess}>
        {state.message}
      </p>
    );
  }
  return null;
}

export function ApplicationCard({
  application,
  institutionTypes,
}: {
  application: SignupApplication;
  institutionTypes: string[];
}) {
  const [state, formAction, pending] = useActionState(reviewSignup, initialState);
  const { institution, currentContact } = application;
  const listId = `types-${application.profileId}`;
  const nameMismatch = !sameName(application.requestedInstitutionName, institution.name);

  return (
    <li className={`${ui.card} p-5`}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="profileId" value={application.profileId} />

        <div>
          <p className="font-semibold">
            {application.name}{" "}
            <span className="font-normal text-muted">· {application.email}</span>
          </p>
          <p className="text-sm text-muted">신청일 {formatDate(application.createdAt)}</p>
        </div>

        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">신청자가 입력한 기관명</dt>
          <dd>{application.requestedInstitutionName ?? "-"}</dd>
          <dt className="text-muted">등록된 기관</dt>
          <dd>
            {institution.name} (요양기관번호 {institution.ykihoCode})
          </dd>
          <dt className="text-muted">기관 종별</dt>
          <dd>{institution.institutionType ?? "아직 지정되지 않음"}</dd>
        </dl>

        {nameMismatch ? (
          <p className={ui.noticeWarning}>
            신청자가 입력한 기관명과 등록된 기관명이 다릅니다. 요양기관번호와 기관을 확인한 뒤 처리해 주세요.
          </p>
        ) : null}
        {currentContact ? (
          <p className={ui.noticeWarning}>
            이 기관에는 이미 승인된 담당자({currentContact.name}, {currentContact.email})가 있습니다. 담당자를 바꾸는
            신청이면 &quot;교체 승인&quot;을 눌러 주세요. 기존 담당자는 승인이 취소(거절)됩니다.
          </p>
        ) : null}

        <label className="text-sm font-medium">
          기관 종별 {institution.institutionType ? "(바꾸려면 수정)" : "(승인하려면 필요)"}
          <input
            name="institutionType"
            list={listId}
            defaultValue={institution.institutionType ?? ""}
            maxLength={30}
            placeholder="목록에서 고르거나 새 종별을 입력"
            className={inputClass}
          />
          <datalist id={listId}>
            {institutionTypes.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <Result state={state} />

        <div className="flex flex-wrap gap-2">
          {currentContact ? (
            <button type="submit" name="decision" value="replace" disabled={pending} className={primaryButton}>
              교체 승인
            </button>
          ) : (
            <button type="submit" name="decision" value="approve" disabled={pending} className={primaryButton}>
              승인
            </button>
          )}
          <button type="submit" name="decision" value="reject" disabled={pending} className={secondaryButton}>
            거절
          </button>
        </div>
      </form>
    </li>
  );
}

export function ContactRow({ contact }: { contact: ApprovedContact }) {
  const [state, formAction, pending] = useActionState(reviewSignup, initialState);

  return (
    <tr>
      <td className={`${ui.td} font-medium`}>{contact.name}</td>
      <td className={ui.td}>{contact.email}</td>
      <td className={ui.td}>
        {contact.institutionName} ({contact.ykihoCode})
      </td>
      <td className={ui.td}>
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="profileId" value={contact.profileId} />
          <button type="submit" name="decision" value="reject" disabled={pending} className={secondaryButton}>
            승인 취소
          </button>
          <Result state={state} />
        </form>
      </td>
    </tr>
  );
}
