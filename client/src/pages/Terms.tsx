import Logo from "@/components/Logo";
import SubtleBackground from "@/components/SubtleBackground";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const terms = [
  {
    title: "제1조 (목적)",
    body: [
      '본 약관은 PassMate(이하 "회사")가 제공하는 AI 자기소개서 분석 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.',
    ],
  },
  {
    title: "제2조 (정의)",
    body: [
      '"서비스"란 회사가 제공하는 AI 기반 자기소개서 분석 및 피드백 서비스를 의미합니다.',
      '"회원"이란 Google 계정 등을 통해 로그인하여 서비스를 이용하는 사람을 의미합니다.',
      '"비회원"이란 회원가입 없이 서비스를 이용하는 사람을 의미합니다.',
      '"분석 결과"란 AI와 회사가 설계한 분석 로직을 기반으로 생성된 리포트 및 피드백을 의미합니다.',
    ],
  },
  {
    title: "제3조 (약관의 효력 및 변경)",
    body: [
      "본 약관은 서비스 내 게시하거나 이용자에게 고지함으로써 효력이 발생합니다.",
      "회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있습니다.",
      "약관이 변경되는 경우 변경 내용 및 시행일을 사전에 공지합니다.",
      "변경된 약관 시행 이후에도 서비스를 계속 이용하는 경우 변경된 약관에 동의한 것으로 봅니다.",
    ],
  },
  {
    title: "제4조 (회원가입)",
    body: [
      "회원가입은 Google 로그인을 통해 진행됩니다.",
      "이용자는 본인의 정보를 정확하게 제공해야 합니다.",
      "타인의 계정을 이용하여 가입할 수 없습니다.",
      "회사는 아래의 경우 회원가입을 거부하거나 취소할 수 있습니다.",
    ],
    items: [
      "타인의 정보를 도용한 경우",
      "허위 정보를 입력한 경우",
      "서비스 운영을 방해할 목적인 경우",
      "관련 법령을 위반한 경우",
    ],
  },
  {
    title: "제5조 (서비스의 제공)",
    body: [
      "회사는 다음 서비스를 제공합니다.",
      "회사는 서비스 내용을 변경하거나 추가할 수 있습니다.",
    ],
    items: [
      "AI 자기소개서 분석",
      "자기소개서 심층 피드백",
      "강점 및 보완점 분석",
      "기업 적합도 분석",
      "기타 회사가 제공하는 관련 서비스",
    ],
  },
  {
    title: "제6조 (무료 및 유료 서비스)",
    body: [
      "회사는 무료 서비스를 제공할 수 있습니다.",
      "일부 서비스는 유료로 제공될 수 있으며, 가격 및 이용조건은 별도로 안내합니다.",
      "유료 서비스 이용 시 별도의 결제 정책이 적용됩니다.",
    ],
  },
  {
    title: "제7조 (이용자의 의무)",
    body: ["이용자는 다음 행위를 해서는 안 됩니다."],
    items: [
      "타인의 계정 도용",
      "서비스의 정상적인 운영을 방해하는 행위",
      "시스템을 해킹하거나 우회하려는 행위",
      "자동화 프로그램을 이용한 비정상적인 이용",
      "회사 또는 제3자의 권리를 침해하는 행위",
      "관계 법령을 위반하는 행위",
    ],
  },
  {
    title: "제8조 (AI 분석 결과)",
    body: [
      "서비스에서 제공하는 분석 결과는 AI 기술을 활용하여 생성되는 참고 정보입니다.",
      "분석 결과는 취업 성공이나 합격을 보장하지 않습니다.",
      "이용자는 분석 결과를 참고자료로 활용하며, 자기소개서 작성 및 제출에 대한 최종 책임은 이용자에게 있습니다.",
      "회사는 AI 기술의 특성상 일부 분석 결과에 오류 또는 부정확한 내용이 포함될 수 있음을 고지합니다.",
    ],
  },
  {
    title: "제9조 (저작권)",
    body: [
      "이용자가 업로드한 자기소개서의 저작권은 이용자에게 있습니다.",
      "회사는 서비스 제공을 위한 범위 내에서만 해당 내용을 처리합니다.",
      "회사가 제작한 분석 리포트 및 서비스 UI 등의 저작권은 회사에 있습니다.",
      "이용자는 회사의 사전 동의 없이 분석 결과를 상업적으로 이용하거나 재배포할 수 없습니다.",
    ],
  },
  {
    title: "제10조 (서비스 이용 제한)",
    body: [
      "회사는 다음의 경우 서비스 이용을 제한하거나 회원 자격을 정지할 수 있습니다.",
    ],
    items: [
      "약관 위반",
      "불법 행위",
      "시스템 악용",
      "타인의 권리 침해",
      "서비스 운영에 중대한 지장을 주는 경우",
    ],
  },
  {
    title: "제11조 (서비스 변경 및 중단)",
    body: [
      "회사는 서비스 개선 또는 시스템 점검 등의 사유로 서비스의 일부 또는 전부를 변경하거나 중단할 수 있습니다.",
      "회사는 가능한 범위에서 사전에 이를 안내합니다.",
    ],
  },
  {
    title: "제12조 (면책)",
    body: [
      "회사는 천재지변, 시스템 장애 등 회사의 합리적인 통제를 벗어난 사유로 발생한 서비스 장애에 대하여 책임을 지지 않습니다.",
      "회사는 AI 분석 결과를 이용하여 발생한 이용자의 의사결정 또는 결과에 대하여 책임을 지지 않습니다.",
      "다만, 회사의 고의 또는 중대한 과실로 발생한 손해에 대해서는 관련 법령에 따라 책임을 부담합니다.",
    ],
  },
  {
    title: "제13조 (개인정보)",
    body: [
      "회사는 관련 법령에 따라 개인정보를 처리하며, 자세한 사항은 개인정보처리방침을 따릅니다.",
    ],
  },
  {
    title: "제14조 (분쟁 해결)",
    body: [
      "본 약관과 관련하여 분쟁이 발생한 경우 회사와 이용자는 성실히 협의하여 해결하도록 노력합니다.",
      "협의가 이루어지지 않는 경우 대한민국 법령을 적용하며, 관할 법원은 민사소송법 등 관련 법령에 따릅니다.",
    ],
  },
];

export default function Terms() {
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
            최종 업데이트: 2026.07.13
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            PassMate 이용약관
          </h1>
        </div>

        <div className="space-y-8 rounded-lg border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl shadow-black/30 sm:p-8">
          {terms.map(section => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-normal text-white">
                {section.title}
              </h2>
              <div className="space-y-2 text-[15px] leading-7 text-gray-300">
                {section.body.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.items && (
                <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-gray-300">
                  {section.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
