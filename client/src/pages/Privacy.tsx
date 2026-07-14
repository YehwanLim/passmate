import Logo from "@/components/Logo";
import SubtleBackground from "@/components/SubtleBackground";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const privacySections = [
  {
    title: "1. 수집하는 개인정보",
    body: ["회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다."],
    groups: [
      {
        title: "회원가입(Google 로그인)",
        items: ["이름(닉네임)", "이메일 주소", "프로필 이미지(URL)"],
        note: "Google 계정을 통해 제공받은 정보만 수집하며, 비밀번호는 저장하지 않습니다.",
      },
      {
        title: "서비스 이용 과정에서 생성되는 정보",
        items: [
          "업로드한 자기소개서 및 문서",
          "AI 분석 결과",
          "서비스 이용 기록",
          "접속 로그",
          "브라우저 정보",
          "IP 주소",
          "쿠키",
        ],
      },
      {
        title: "결제 서비스 이용 시 (향후 제공 예정)",
        body: [
          "유료 서비스 제공 시에는 결제 서비스 제공업체를 통해 필요한 결제 정보가 처리될 수 있습니다.",
          "회사는 카드번호 등 결제 정보를 직접 저장하지 않습니다.",
        ],
      },
    ],
  },
  {
    title: "2. 개인정보의 이용 목적",
    body: ["회사는 다음 목적에 한하여 개인정보를 이용합니다."],
    items: [
      "회원 식별 및 로그인",
      "AI 자기소개서 분석 서비스 제공",
      "분석 결과 생성 및 저장",
      "고객 문의 대응",
      "서비스 개선 및 품질 향상",
      "부정 이용 방지",
      "법령상 의무 이행",
    ],
    footer:
      "회사는 이용자의 동의 없이 위 목적 외의 용도로 개인정보를 이용하지 않습니다.",
  },
  {
    title: "3. 개인정보의 보관 및 이용 기간",
    body: [
      "회사는 개인정보 수집 및 이용 목적이 달성되면 지체 없이 개인정보를 파기합니다.",
      "다만 다음의 경우에는 일정 기간 보관할 수 있습니다.",
    ],
    table: {
      headers: ["보관 대상", "보관 기간"],
      rows: [
        ["회원 정보", "회원 탈퇴 시까지"],
        ["업로드한 자기소개서", "회원이 삭제하거나 탈퇴 시까지"],
        ["서비스 이용 기록", "최대 1년"],
        ["관계 법령에 따른 보관 정보", "관련 법령에 따름"],
      ],
    },
  },
  {
    title: "4. 개인정보의 제3자 제공",
    body: [
      "회사는 이용자의 개인정보를 외부에 판매하거나 제공하지 않습니다.",
      "다만 다음의 경우에는 예외로 합니다.",
    ],
    items: ["이용자가 사전에 동의한 경우", "법령에 따라 요구되는 경우"],
  },
  {
    title: "5. 개인정보 처리의 위탁",
    body: [
      "회사는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리를 위탁할 수 있습니다.",
    ],
    table: {
      headers: ["수탁업체", "이용 목적"],
      rows: [
        ["Supabase", "회원 정보 및 데이터 저장"],
        ["Google", "OAuth 로그인"],
        ["OpenAI 또는 Google Gemini 등 AI 제공사", "자기소개서 분석 및 AI 응답 생성"],
        ["Vercel", "서비스 호스팅"],
      ],
    },
    footer:
      "향후 서비스 변경에 따라 위탁업체는 변경될 수 있으며 변경 시 본 방침을 통해 안내합니다.",
  },
  {
    title: "6. AI 분석을 위한 데이터 처리",
    body: [
      "이용자가 업로드한 자기소개서는 AI 분석을 위해 외부 AI 서비스(OpenAI, Google Gemini 등)에 전달되어 처리될 수 있습니다.",
      "회사는 서비스 제공 목적 외에는 해당 데이터를 이용하지 않으며, AI 서비스 제공자의 정책에 따라 처리됩니다.",
    ],
  },
  {
    title: "7. 개인정보의 파기",
    body: [
      "회사는 개인정보의 보관 기간이 종료되거나 처리 목적이 달성된 경우 지체 없이 개인정보를 파기합니다.",
      "전자적 파일은 복구가 불가능한 방법으로 삭제하며, 출력물은 분쇄 또는 소각합니다.",
    ],
  },
  {
    title: "8. 이용자의 권리",
    body: ["이용자는 언제든지 다음 권리를 행사할 수 있습니다."],
    items: [
      "개인정보 조회",
      "개인정보 수정",
      "개인정보 삭제",
      "회원 탈퇴",
      "개인정보 처리 정지 요청",
    ],
    footer:
      "회원 탈퇴 시 관련 개인정보는 관계 법령에 따른 보관 의무가 있는 경우를 제외하고 지체 없이 삭제됩니다.",
  },
  {
    title: "9. 쿠키(Cookie)의 사용",
    body: [
      "회사는 서비스 제공 및 이용자 편의 향상을 위해 쿠키를 사용할 수 있습니다.",
      "이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.",
      "다만 쿠키를 차단할 경우 일부 서비스 이용이 제한될 수 있습니다.",
    ],
  },
  {
    title: "10. 개인정보 보호를 위한 조치",
    body: ["회사는 개인정보 보호를 위해 다음과 같은 조치를 시행합니다."],
    items: [
      "HTTPS 암호화 통신",
      "접근 권한 최소화",
      "데이터 접근 통제",
      "정기적인 보안 점검",
    ],
  },
  {
    title: "11. 아동의 개인정보",
    body: [
      "본 서비스는 만 14세 미만 아동을 대상으로 하지 않습니다.",
      "만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.",
    ],
  },
  {
    title: "12. 개인정보처리방침의 변경",
    body: [
      "본 방침은 관련 법령 또는 서비스 변경에 따라 수정될 수 있습니다.",
      "중요한 변경 사항이 있는 경우 서비스 내 공지사항 등을 통해 안내합니다.",
    ],
  },
  {
    title: "13. 개인정보 보호책임자 및 문의",
    body: [
      "서비스 이용 중 개인정보 관련 문의는 아래로 연락해 주시기 바랍니다.",
      "이메일: support@passmate.ai",
    ],
  },
  {
    title: "부칙",
    body: ["본 개인정보처리방침은 2026년 7월 13일부터 시행됩니다."],
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <SubtleBackground />
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#050505]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="w-5 h-5" textClassName="text-[15px] text-white" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-4xl px-5 py-12 sm:py-16">
        <div className="mb-10">
          <p className="mb-3 text-[13px] font-medium text-blue-300">
            최종 업데이트: 2026년 7월 13일
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            개인정보처리방침
          </h1>
          <div className="mt-6 space-y-3 text-[15px] leading-7 text-gray-300">
            <p>
              PassMate(이하 "회사")는 「개인정보 보호법」 등 관련 법령을
              준수하며, 이용자의 개인정보를 안전하게 보호하기 위해 최선을
              다합니다.
            </p>
            <p>
              본 개인정보처리방침은 회사가 제공하는 AI 자기소개서 분석
              서비스(이하 "서비스")에서 이용자의 개인정보를 어떻게 수집, 이용,
              보관 및 보호하는지 안내합니다.
            </p>
          </div>
        </div>

        <div className="space-y-8 rounded-lg border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl shadow-black/30 sm:p-8">
          {privacySections.map(section => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-normal text-white">
                {section.title}
              </h2>
              {section.body && (
                <div className="space-y-2 text-[15px] leading-7 text-gray-300">
                  {section.body.map(paragraph => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              )}
              {section.groups?.map(group => (
                <div key={group.title} className="space-y-2 pt-1">
                  <h3 className="text-[15px] font-semibold text-gray-100">
                    {group.title}
                  </h3>
                  {group.body?.map(paragraph => (
                    <p
                      key={paragraph}
                      className="text-[15px] leading-7 text-gray-300"
                    >
                      {paragraph}
                    </p>
                  ))}
                  {group.items && (
                    <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-gray-300">
                      {group.items.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {group.note && (
                    <p className="text-[14px] leading-6 text-gray-400">
                      {group.note}
                    </p>
                  )}
                </div>
              ))}
              {section.items && (
                <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-gray-300">
                  {section.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.table && (
                <div className="overflow-hidden rounded-lg border border-white/[0.08]">
                  <table className="w-full border-collapse text-left text-[14px] text-gray-300">
                    <thead className="bg-white/[0.05] text-gray-100">
                      <tr>
                        {section.table.headers.map(header => (
                          <th key={header} className="px-4 py-3 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map(row => (
                        <tr key={row.join("-")} className="border-t border-white/[0.06]">
                          {row.map(cell => (
                            <td key={cell} className="px-4 py-3 align-top">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {section.footer && (
                <p className="text-[15px] leading-7 text-gray-300">
                  {section.footer}
                </p>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
