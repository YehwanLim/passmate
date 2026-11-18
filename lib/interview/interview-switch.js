// AI 면접 연습 판매·사용 스위치(entitlement_settings.interview_enabled). 세션 생성은 getEntitlementSummary 가 보지만,
// 입장권·피드백처럼 비용이 드는 경로도 매번 다시 본다 — 사고 때 관리자가 끄면 바로 멈춰야 한다.

const SETTINGS_ID = "singleton";

export async function isInterviewEnabled(db) {
  const setting = await db.entitlementSetting.findUnique({ where: { id: SETTINGS_ID }, select: { interviewEnabled: true } });
  return setting?.interviewEnabled === true;
}
