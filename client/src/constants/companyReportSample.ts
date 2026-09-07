import type { CompanyReportData } from "@/types/companyReport";
import { COMPANY_REPORT_SAMPLE_COMPANY, COMPANY_REPORT_SAMPLE_JOB_ROLE } from "./companyReportSampleMeta";

/**
 * 공개 샘플 리포트(/company-report?sample=1, 랜딩 소개 섹션).
 * scripts/manual/company-analysis-probe.mjs --out 으로 생성한 실제 리포트를 사용자가 검수해 굳힌 것이다.
 * 갱신: node --env-file=.env scripts/manual/company-analysis-probe.mjs "<회사>" "<직무>" --out sample.json
 *       → result 에서 analysisMeta 를 뺀 나머지를 report 에 붙여 넣는다(searchEntryPointHtml 포함 — 검색 그라운딩 약관).
 * 리포트 문장은 손으로 고치지 않는다(실제 생성 결과를 보여 주는 것이 샘플의 목적).
 */
export const COMPANY_REPORT_SAMPLE: {
  company: string;
  jobRole: string;
  report: CompanyReportData;
} = {
  company: COMPANY_REPORT_SAMPLE_COMPANY,
  jobRole: COMPANY_REPORT_SAMPLE_JOB_ROLE,
  report: {
    brief: {
      oneLiner:
        "메모리 반도체와 스마트폰을 기반으로 AI, 파운드리, 전장 등 미래 기술을 선도하는 기업",
      keywords: [
        "반도체",
        "AI",
        "파운드리",
        "HBM",
        "스마트폰",
        "가전",
        "전장부품",
      ],
      asOf: "2026-09-07",
      positionInIndustry:
        "메모리 반도체 시장에서 독보적인 글로벌 선두 지위를 유지하고 있으며, 파운드리 시장에서는 TSMC와 경쟁하며 AI 반도체 수요에 대응하고 있습니다.",
    },
    businessMap: {
      summary:
        "삼성전자는 크게 반도체를 담당하는 DS(Device Solutions) 부문과 완제품을 담당하는 DX(Device eXperience) 부문, 그리고 디스플레이 패널과 전장·오디오 사업을 통해 수익을 창출하는 복합 전자 플랫폼 기업입니다. 각 부문은 유기적으로 연결되어 시너지를 내며 광범위한 제품 포트폴리오를 구축하고 있습니다.",
      segments: [
        {
          name: "DS (Device Solutions) 부문",
          whatItDoes:
            "메모리(DRAM, NAND Flash), 시스템LSI(모바일 AP, 카메라 센서칩), 파운드리(반도체 위탁생산) 사업을 영위하며, AI 시대의 핵심 인프라를 제공합니다.",
          weight:
            "전사 매출과 영업이익의 상당 부분을 차지하며, 특히 최근 AI 반도체 수요 증가로 실적 개선을 주도하고 있습니다.",
          phase: "성장",
          sourceIds: [12, 17, 34, 42],
        },
        {
          name: "DX (Device eXperience) 부문",
          whatItDoes:
            "스마트폰(갤럭시), TV, 생활가전, 네트워크 시스템, PC 등 소비자 접점의 다양한 완제품을 개발, 생산, 판매합니다.",
          weight:
            "매출 규모가 크지만, 핵심 부품 가격 상승 등의 영향으로 DS 부문 대비 수익성 개선폭은 제한적일 수 있습니다.",
          phase: "성숙",
          sourceIds: [12, 17, 34, 42],
        },
        {
          name: "SDC (Samsung Display Corporation)",
          whatItDoes:
            "OLED를 중심으로 한 디스플레이 패널을 생산하며, 스마트폰, TV, 그리고 최근 확장현실(XR) 기기 등으로 적용처를 확대하고 있습니다.",
          weight:
            "주요 사업부문 중 하나로, 고부가 패널 시장에서 경쟁력을 확보하고 있습니다.",
          phase: "성장",
          sourceIds: [19, 34, 42],
        },
        {
          name: "Harman",
          whatItDoes:
            "디지털 콕핏, 카오디오 등 전장 부품과 오디오 사업을 담당하며, 자동차 산업의 전동화 및 지능화 트렌드에 맞춰 사업을 확장하고 있습니다.",
          weight:
            "전체 사업에서 차지하는 비중은 상대적으로 작지만, 미래 성장 동력으로 중요성이 커지고 있습니다.",
          phase: "성장",
          sourceIds: [4, 34, 42],
        },
      ],
      customersAndCompetitors:
        "주요 고객사로는 애플, 베스트바이, 도이치텔레콤, 퀄컴, 버라이즌 등이 있으며, 반도체 분야에서는 TSMC, SK하이닉스, 마이크론 등과, 완제품 분야에서는 애플, LG전자 등과 경쟁하고 있습니다.",
    },
    focusBusinesses: {
      statedDirection:
        "삼성전자는 '인재와 기술'을 핵심 철학으로 삼아, 인공지능(AI), 로봇, 바이오, 반도체 등 미래 기술에 대한 과감한 투자와 인재 발탁을 통해 미래 경쟁력을 확보하고 사업 체질을 개선하는 데 집중하고 있습니다.",
      items: [
        {
          name: "AI 반도체 생태계 강화 및 차세대 파운드리 기술",
          whatChanged:
            "2026년 'SAFE 포럼'을 개최하여 AI 반도체 생태계 협력 전략과 차세대 파운드리 기술 로드맵을 공개했습니다.",
          evidence:
            "2나노 공정 기술과 AI 반도체에 최적화된 공정 혁신 방향을 제시하고, 국내외 팹리스 기업들과의 협력을 강화하며 MPW(Multi Project Wafer) 프로그램을 통해 시제품 제작을 지원하고 있습니다.",
          whyNow:
            "인공지능 산업의 급격한 개화와 맞춤형 반도체(ASIC) 수요 증가로 파운드리 역량의 중요성이 커지고 있으며, 이는 삼성전자가 AI 반도체 시장 주도권을 확보할 기회로 작용하고 있습니다.",
          relevanceToRole:
            "직접. 전략기획 직무는 AI 반도체 시장의 변화를 분석하고, 파운드리 사업의 중장기 기술 로드맵 및 고객사 협력 전략을 수립하는 데 핵심적인 역할을 수행합니다.",
          sourceIds: [2, 4, 6, 8, 9, 10],
        },
        {
          name: "고대역폭 메모리(HBM) 시장 리더십 강화",
          whatChanged:
            "2026년 1분기에 업계 최초로 HBM4와 차세대 저전력 메모리 모듈 SOCAMM2를 동시 양산하고 판매를 시작했습니다. 또한, 메모리 생산 능력의 최대 70%까지 5년 이상의 장기공급계약(LTA)을 체결하여 시장 변동성을 줄이고 있습니다.",
          evidence:
            "HBM4 양산 및 PCIe Gen6 SSD 적기 개발을 통해 메모리 시장을 선도하고 있으며, 엔비디아의 AI 추론용 반도체 '그록3 LPX'의 언어처리장치(LPU)를 4나노 공정에서 생산하는 등 주요 고객사와의 협력을 확대하고 있습니다.",
          whyNow:
            "AI 인프라 투자 급증으로 HBM을 포함한 고부가 메모리 수요가 폭발적으로 증가하고 있으며, 이는 삼성전자의 실적 개선과 시장 지위 강화에 결정적인 영향을 미치고 있습니다.",
          relevanceToRole:
            "직접. 전략기획 직무는 HBM 등 고부가 메모리 제품의 시장 수요를 예측하고, 생산 및 공급 전략을 수립하며, 장기 고객사 확보 방안을 모색하는 데 중요한 역할을 합니다.",
          sourceIds: [3, 12, 15, 17],
        },
        {
          name: "전장 및 공조, 가전 사업 확대",
          whatChanged:
            "2025년에 독일 공조업체 플랙트그룹을 인수하고, 하만이 독일 ZF의 첨단 운전자 보조 시스템(ADAS) 사업을 인수하는 등 전장 및 공조 분야에서 조 단위 M&A를 진행했습니다.",
          evidence:
            "2025년 아일랜드 존슨콘트롤즈 인터내셔널(JCI)의 냉난방공조(HVAC) 사업 인수를 추진하고, 미국 레녹스와 합작사를 설립하는 등 적극적인 투자를 통해 신성장 동력을 확보하고 있습니다.",
          whyNow:
            "반도체 자체 M&A보다는 시너지를 낼 수 있는 전장, 공조, 가전 등 영역에 집중하여 미래 먹거리를 발굴하려는 전략입니다. 기후 변화와 데이터센터 공조 설비 수요 증가도 이 분야의 성장을 견인하고 있습니다.",
          relevanceToRole:
            "간접. 전략기획 직무는 전장, 공조, 가전 등 신사업 분야의 시장 동향을 분석하고, M&A 및 파트너십 전략을 수립하여 사업 포트폴리오를 다각화하는 데 기여할 수 있습니다.",
          sourceIds: [4],
        },
        {
          name: "확장현실(XR) 기기 및 마이크로 디스플레이 사업화",
          whatChanged:
            "2025년 12월, 삼성디스플레이는 확장현실(XR) 헤드셋 '갤럭시 XR'에 들어가는 마이크로 디스플레이 사업화를 위해 M(마이크로 디스플레이) 프로젝트팀을 중소형사업부 직속의 M사업화팀으로 신설했습니다.",
          evidence:
            "삼성디스플레이는 OLEDoS(OLED on Silicon)를 2025년 10월 말 상용화했으며, 삼성전자가 출시한 XR 기기에 공급을 시작했습니다.",
          whyNow:
            "마이크로 디스플레이는 1인치 안팎의 작은 화면에 초고해상도를 구현하는 패널로, 차세대 AI 기반 디바이스에 필수적인 기술로 부상하고 있어 미래 시장 선점을 위한 중요한 사업입니다.",
          relevanceToRole:
            "간접. 전략기획 직무는 XR 시장의 성장 가능성을 분석하고, 마이크로 디스플레이 기술 로드맵 및 사업화 전략을 수립하여 미래 디바이스 시장에서의 경쟁 우위를 확보하는 데 기여할 수 있습니다.",
          sourceIds: [19],
        },
      ],
      translatedTalentKeywords: [
        {
          stated: "도전정신",
          meaning:
            "기존의 성공 방식에 안주하지 않고, AI, 파운드리 등 새로운 기술 패권 경쟁에서 주도권을 확보하기 위해 끊임없이 기술적 한계를 돌파하고 사업 모델을 혁신하려는 의지",
        },
        {
          stated: "주인의식",
          meaning:
            "메모리, 파운드리, 스마트폰 등 각 사업 부문의 글로벌 시장 지위를 공고히 하고, 전사적인 관점에서 미래 성장 동력을 발굴하며 사업 포트폴리오를 최적화하려는 책임감",
        },
        {
          stated: "글로벌 마인드",
          meaning:
            "글로벌 AI 반도체 고객사 및 파트너사와의 협력을 강화하고, 해외 시장의 변화와 규제 환경을 면밀히 분석하여 사업 기회를 창출하며 리스크에 선제적으로 대응하는 역량",
        },
        {
          stated: "협업",
          meaning:
            "DS, DX, SDC, Harman 등 다양한 사업 부문 간 시너지를 창출하고, 국내외 팹리스, EDA, IP 기업들과의 파운드리 생태계 협력을 통해 기술 혁신을 가속화하는 소통 능력",
        },
      ],
    },
    financialSnapshot: {
      listed: true,
      market: "유가증권시장 · 삼성전자",
      revenueTrend:
        "삼성전자의 매출은 2025년 4분기부터 2026년 2분기까지 3분기 연속 역대 최대 실적을 달성하며 뚜렷한 성장세를 보였습니다. 특히 2026년 2분기 매출은 전년 동기 대비 129.31% 증가한 171조 원을 기록했습니다.",
      profitTrend:
        "영업이익 역시 2025년 4분기부터 2026년 2분기까지 3분기 연속 역대 최대치를 경신하며 급증했습니다. 2026년 2분기 영업이익은 전년 동기 대비 19배 이상 증가한 89조 4천억 원을 기록했으며, 이는 AI 인프라 투자 확대에 따른 반도체 수요 증가가 주된 원인으로 분석됩니다. DS 부문의 실적 개선이 두드러진 반면, DX 부문은 핵심 부품 가격 상승으로 수익성 개선폭이 제한적이었습니다.",
      keyFigures: [
        {
          label: "2026년 2분기 매출",
          value: "171조 원",
          period: "2026년 2분기",
          sourceIds: [11, 17],
        },
        {
          label: "2026년 2분기 영업이익",
          value: "89조 4천억 원",
          period: "2026년 2분기",
          sourceIds: [11, 17],
        },
        {
          label: "2026년 1분기 매출",
          value: "133.9조 원",
          period: "2026년 1분기",
          sourceIds: [12],
        },
        {
          label: "2026년 1분기 영업이익",
          value: "57.2조 원",
          period: "2026년 1분기",
          sourceIds: [12],
        },
      ],
      marketView:
        "2026년 9월 7일 기준 삼성전자 주가는 270,000원을 기록했으며, 시가총액은 1,738조 6,485억 원입니다. 시장은 AI 인프라 투자 급증에 따른 반도체 재고 부족과 HBM 시장에서의 영향력 강화에 주목하며 하반기 실적에 대한 기대감을 높이고 있습니다. 다만, DX 부문 노조 파업 우려 등 내부 잡음은 부정적인 요소로 꼽힙니다.",
      recentDisclosures: [
        {
          title: "2026년 2분기 경영실적 발표",
          when: "2026-07",
          sourceIds: [7, 20, 25],
        },
        {
          title: "주요사항보고서(자기주식취득결정)",
          when: "2026-08",
          sourceIds: [31],
        },
        {
          title: "2026년 1분기 경영실적 발표",
          when: "2026-04",
          sourceIds: [7, 12, 25],
        },
        {
          title: "2026년 주주환원정책 및 실적",
          when: "2026-08",
          sourceIds: [23],
        },
      ],
      fundingNote: "",
      forApplicant:
        "**최근의 대규모 매출 및 영업이익 성장은 AI 반도체 시장의 폭발적인 성장에 따른 DS 부문의 투자 여력 확대와 신사업 추진 동력을 보여줍니다.** 이는 전략기획 직무 지원자에게 회사가 미래 성장 동력 확보에 적극적이며, 새로운 사업 기회를 모색하고 실행할 기회가 많다는 신호로 해석될 수 있습니다.",
    },
    currentIssues: [
      {
        title: "AI 반도체 시장 주도권 경쟁 심화",
        when: "2026-07",
        fact: "삼성전자는 'SAFE 포럼 2026'에서 2나노 전략을 공개하며 AI 반도체 생태계 협력을 강화하고 있지만, 파운드리 시장에서 TSMC와의 점유율 격차를 줄이는 것이 과제로 남아있습니다.",
        whyItMatters:
          "AI 반도체는 미래 산업의 핵심 동력이며, 이 시장에서의 주도권 확보는 삼성전자의 장기적인 성장과 수익성에 결정적인 영향을 미칩니다.",
        forApplicant:
          "AI 반도체 시장의 경쟁 구도와 삼성전자의 차별화 전략을 이해하고, 이를 통해 회사의 미래 성장 방향을 제시할 수 있어야 합니다.",
        sourceIds: [2, 9, 10, 21],
      },
      {
        title: "HBM 시장 1위 도약 과제",
        when: "2026-09",
        fact: "이재용 회장이 2025년 초 '사즉생' 각오를 강조하며 HBM 경쟁력 회복을 주문한 이후, 삼성전자는 HBM4 양산 및 장기공급계약 확대를 통해 시장 지위 강화를 추진하고 있습니다.",
        whyItMatters:
          "고대역폭 메모리(HBM)는 AI 서버의 핵심 부품으로, 이 시장에서의 리더십은 전체 메모리 사업의 수익성과 기술 리더십을 좌우합니다.",
        forApplicant:
          "HBM 기술의 중요성과 시장 동향을 파악하고, 삼성전자가 HBM 시장에서 1위로 도약하기 위한 전략적 방안을 고민해야 합니다.",
        sourceIds: [3, 12, 15, 17],
      },
      {
        title: "DX 부문 노조 파업 가능성",
        when: "2026-09",
        fact: "삼성전자 DX(디바이스 경험) 사업부의 노동조합 '동행노조'가 파업 가능성을 제기하며 미국 타임스퀘어에 메시지 광고를 송출하는 등 내부 잡음이 불거지고 있습니다.",
        whyItMatters:
          "노사 관계의 불안정성은 기업 이미지에 부정적인 영향을 미칠 수 있으며, 생산 차질로 이어질 경우 DX 부문의 실적과 경쟁력에 악영향을 줄 수 있습니다.",
        forApplicant:
          "회사의 노사 관계 현황을 인지하고, 이러한 이슈가 사업 운영에 미칠 수 있는 영향과 회사의 대응 방안에 대해 합리적인 시각을 가질 필요가 있습니다.",
        sourceIds: [3],
      },
      {
        title: "미래 기술 인재 확보 및 조직 개편",
        when: "2025-11",
        fact: "2025년 말 사장단 인사 및 2026년 임원 인사를 통해 세계적 석학을 삼성종합기술원(SAIT) 원장으로 영입하고 소프트웨어 전문가를 DX부문 CTO로 승진시키는 등 미래 기술 리더십 강화를 위한 인재 발탁이 있었습니다.",
        whyItMatters:
          "AI, 양자컴퓨팅, 뉴로모픽 반도체 등 차세대 기술 경쟁에서 우위를 점하기 위해서는 핵심 인재 확보와 연구 조직의 효율적인 운영이 필수적입니다.",
        forApplicant:
          "회사가 미래 기술 확보를 위해 어떤 인재를 중요하게 생각하고 있는지 이해하고, 본인의 강점을 미래 기술 역량과 연결하여 어필할 수 있습니다.",
        sourceIds: [5, 13, 22, 24, 26, 29, 30],
      },
      {
        title: "주주환원정책 확대",
        when: "2026-08",
        fact: "삼성전자는 2024년부터 2026년까지 3년간 발생하는 총 Free Cash Flow의 50%를 주주환원에 활용하며, 2026년 3분기에는 30조 원 내외 규모의 현금배당을 시행할 계획입니다.",
        whyItMatters:
          "적극적인 주주환원 정책은 투자자 신뢰를 높이고 기업 가치를 제고하는 중요한 요소이며, 이는 회사의 재무 건전성과 미래 투자 여력을 간접적으로 보여줍니다.",
        forApplicant:
          "회사의 재무적 안정성과 주주 가치 제고 노력을 이해하고, 이것이 장기적인 사업 전략과 어떻게 연결되는지 파악하는 데 도움이 됩니다.",
        sourceIds: [23],
      },
    ],
    roleInContext: {
      whereItSits:
        "전략기획 직무는 주로 전사 경영 전략을 수립하고 각 사업 부문의 중장기 성장 방향을 제시하는 역할을 수행하며, DS 부문, DX 부문 등 다양한 사업 영역과 연계될 수 있습니다.",
      problemsItSolves: [
        "글로벌 반도체 시장의 변동성과 AI 기술 패권 경쟁 속에서 삼성전자의 초격차 기술 리더십을 유지하고 강화할 전략 수립",
        "HBM, 파운드리 등 고부가 사업의 중장기 성장 로드맵을 구축하고, 신규 고객사 및 파트너십 발굴을 통한 시장 점유율 확대 방안 모색",
        "전장, 로봇, 바이오 등 신사업 분야의 시장 기회를 분석하고, M&A 및 투자 전략을 통해 사업 포트폴리오를 다각화하는 방안 제시",
        "글로벌 공급망 재편, 지정학적 리스크 등 대외 불확실성에 선제적으로 대응하고, 지속 가능한 성장을 위한 리스크 관리 전략 수립",
      ],
      whyHiringNow:
        "현재 삼성전자는 AI 시대의 급변하는 기술 환경 속에서 미래 성장 동력을 확보하고, 사업 구조를 고도화해야 하는 중요한 전환점에 있습니다. 따라서 **전략기획 직무는 이러한 변화의 흐름을 읽고, 회사의 자원을 효율적으로 배분하며, 새로운 사업 기회를 발굴하여 실행할 수 있는 핵심 인재를 확보하기 위해 채용을 확대하는 것으로 보입니다.**",
      recentNewsForRole: [
        {
          title: "삼성, 2026년 하반기 공채 실시",
          when: "2026-09",
          fact: "삼성전자를 포함한 19개 계열사가 2026년 하반기 신입사원 공개채용을 진행하며, 9월 직무적합성 평가를 시작으로 11월 면접이 진행될 예정입니다.",
          whyForRole:
            "전략기획 직무는 전사적인 관점에서 인재 확보 및 육성 전략과도 연결될 수 있습니다. 채용 과정에서 회사의 미래 비전과 인재상을 명확히 이해하고, 본인이 회사의 전략적 목표 달성에 어떻게 기여할 수 있을지 구체적인 계획을 제시하는 것이 중요합니다.",
          sourceIds: [33, 36, 39, 40, 41],
        },
        {
          title:
            "삼성전자, 2026년 사장단 인사…'DX 대표이사직 신설' 투트랙 체제 가동",
          when: "2025-11",
          fact: "2025년 11월, 삼성전자는 DS와 DX를 각각 총괄하는 2인 대표이사 체제를 다시 구성하고, DX부문 CTO 사장 겸 삼성리서치장으로 윤장현 사장을 승진시키는 등 기술 조직을 강화했습니다.",
          whyForRole:
            "전략기획 직무 지원자는 이러한 조직 개편의 배경과 의미를 이해하고, 각 사업 부문의 책임 경영 강화가 전사 전략 수립에 어떤 영향을 미칠지 파악해야 합니다. 특히 DX 부문의 기술 전략 강화가 모바일, 가전 등 완제품 사업의 미래 방향과 어떻게 연결되는지 고민해볼 수 있습니다.",
          sourceIds: [13, 22, 26],
        },
        {
          title:
            "삼성전자, 'SAFE 포럼 2026'서 2나노 전략 공개…AI 생태계 협력 강화",
          when: "2026-07",
          fact: "삼성전자가 2026년 7월 'SAFE 포럼 2026'을 개최하여 AI 반도체 생태계 협력 전략과 차세대 파운드리 기술 로드맵을 공개했습니다.",
          whyForRole:
            "전략기획 직무 지원자에게는 AI 반도체 시장의 성장 가능성과 삼성전자의 파운드리 기술 경쟁력을 이해하는 것이 필수적입니다. 이 포럼에서 제시된 2나노 공정, AI 반도체 최적화 기술, 그리고 국내외 팹리스 기업과의 협력 방안을 자소서 및 면접에서 구체적인 사례로 활용하여 본인의 전략적 사고를 보여줄 수 있습니다.",
          sourceIds: [2, 6, 8, 9, 10],
        },
        {
          title: "이재용 삼성전자 하반기 '영업이익 200조'와 'HBM 1위' 잰걸음",
          when: "2026-09",
          fact: "이재용 삼성전자 회장이 2025년 초 '사즉생' 각오를 강조하며 HBM 경쟁력 회복에 속도를 내야 한다고 당부했으며, 2026년 하반기에는 메모리 생산 능력의 70%까지 5년 장기공급계약 비중 확대를 추진하고 있습니다.",
          whyForRole:
            "전략기획 직무는 회장님의 경영 메시지를 사업 전략으로 구체화하는 역할을 합니다. HBM 시장의 중요성과 장기공급계약의 의미를 이해하고, 이를 통해 메모리 사업의 안정성과 수익성을 극대화할 수 있는 전략적 아이디어를 제시하는 것이 중요합니다.",
          sourceIds: [15],
        },
      ],
      postingReading: "",
    },
    opportunitiesAndRisks: {
      opportunities: [
        {
          headline: "AI 시대 핵심 인프라 주도",
          text: "AI 기술의 발전은 고성능 반도체, 특히 HBM과 첨단 파운드리 공정 수요를 폭발적으로 증가시키고 있습니다. **삼성전자는 메모리 분야의 독보적인 기술력과 파운드리 역량을 바탕으로 AI 시대의 핵심 인프라 공급자로서 시장을 주도할 강력한 기회를 가지고 있습니다.**",
          sourceIds: [2, 3, 9, 10, 12, 15, 17],
        },
        {
          headline: "미래 사업 포트폴리오 확장",
          text: "전장, 공조, XR 기기 등 신사업 분야에 대한 적극적인 M&A와 투자는 삼성전자의 사업 포트폴리오를 다각화하고 새로운 성장 동력을 확보하는 기회가 됩니다. **이는 기존 주력 사업의 변동성을 보완하고 장기적인 관점에서 안정적인 성장을 가능하게 할 것입니다.**",
          sourceIds: [4, 19],
        },
        {
          headline: "글로벌 기술 리더십 강화",
          text: "세계적 석학 영입, 기술 조직 강화, 그리고 국내외 파트너사와의 협력 생태계 구축은 삼성전자의 기술 경쟁력을 한층 더 끌어올릴 것입니다. **이를 통해 양자컴퓨팅, 뉴로모픽 반도체 등 차세대 기술 분야에서 선도적인 위치를 확보할 수 있습니다.**",
        },
      ],
      risks: [
        {
          headline: "파운드리 시장 경쟁 심화",
          text: "AI 반도체 수요 증가로 파운드리 시장의 중요성이 커지고 있지만, 대만 TSMC와의 격차를 줄이고 고객사 확보 경쟁에서 우위를 점하는 것이 중요한 과제입니다. **'고객사이자 경쟁사'라는 딜레마를 극복하고 안정적인 고객 관계를 구축하는 전략이 필요합니다.**",
          sourceIds: [14, 21],
        },
        {
          headline: "메모리 업황 변동성 관리",
          text: "HBM 등 고부가 메모리 수요가 급증하고 있지만, 범용 메모리 시장은 여전히 업황 변동성에 민감합니다. **장기공급계약 확대와 같은 노력에도 불구하고, 시장 상황 변화에 유연하게 대응하고 안정적인 수익성을 확보하는 것이 중요합니다.**",
          sourceIds: [3, 12, 15, 34],
        },
        {
          headline: "내부 조직 안정화 및 인재 관리",
          text: "DX 부문 노조 파업 가능성 등 내부 잡음은 기업의 안정적인 운영과 이미지에 부정적인 영향을 미칠 수 있습니다. **미래 기술 인재 확보와 더불어 기존 인력의 동기 부여 및 노사 관계의 원만한 해결을 위한 노력이 지속되어야 합니다.**",
          sourceIds: [3, 5, 13, 22, 24],
        },
      ],
    },
    businessCandidates: [
      {
        name: "AI 반도체 파운드리 사업 확장 전략",
        whyForThisRole:
          "AI 시대의 핵심 성장 동력인 파운드리 사업은 삼성전자의 미래를 좌우할 중요한 영역입니다. 전략기획 직무는 이 분야에서 시장 분석, 기술 로드맵 수립, 고객사 확보 전략 등 핵심적인 역할을 수행할 수 있습니다.",
        angle:
          "글로벌 AI 팹리스 기업들과의 협력을 강화하고, 2나노 등 첨단 공정 기술을 활용하여 맞춤형 반도체 수요에 선제적으로 대응하는 전략을 제시하는 각도로 접근할 수 있습니다.",
        experienceToPrepare:
          "반도체 산업에 대한 이해, 시장 분석 및 전략 수립 경험, 혹은 기술 기반 사업 개발 경험",
        seedSentence:
          "AI 반도체 시장의 성장 기회를 포착하여 삼성전자 파운드리 사업의 글로벌 리더십을 강화할 전략을 수립하고 싶습니다.",
      },
      {
        name: "HBM 시장 1위 달성을 위한 중장기 로드맵",
        whyForThisRole:
          "HBM은 AI 메모리 시장의 핵심이며, 삼성전자가 이 분야에서 1위로 도약하는 것은 전사적인 목표입니다. 전략기획 직무는 HBM 기술 개발 방향, 생산 및 공급 최적화, 그리고 장기 고객 확보 방안을 총괄적으로 기획할 수 있습니다.",
        angle:
          "경쟁사 대비 삼성전자 HBM의 차별화된 강점을 분석하고, 이를 바탕으로 기술 로드맵, 생산 능력 확장, 그리고 주요 AI 기업들과의 전략적 파트너십을 통해 시장 점유율을 확대할 방안을 제시하는 각도로 접근할 수 있습니다.",
        experienceToPrepare:
          "메모리 반도체 기술 이해, 공급망 관리 또는 사업 개발 경험, 데이터 기반 의사결정 경험",
        seedSentence:
          "HBM 시장의 초격차를 확보하기 위한 삼성전자의 기술 및 사업 전략을 수립하고 실행하는 데 기여하고 싶습니다.",
      },
      {
        name: "전장 및 XR 등 신사업 포트폴리오 고도화",
        whyForThisRole:
          "전장, 공조, XR 등은 삼성전자가 미래 성장 동력으로 집중하는 신사업 분야입니다. 전략기획 직무는 이들 사업의 시장 잠재력을 평가하고, 기존 사업과의 시너지를 창출하며, M&A 또는 파트너십을 통한 사업 확장을 기획할 수 있습니다.",
        angle:
          "각 신사업 분야의 시장 트렌드를 분석하고, 삼성전자의 핵심 역량(반도체, 디스플레이, 모바일)을 활용하여 경쟁 우위를 확보할 수 있는 구체적인 사업화 전략을 제시하는 각도로 접근할 수 있습니다.",
        experienceToPrepare:
          "신사업 기획 또는 시장 진출 전략 수립 경험, M&A 분석 경험, 기술 융합 서비스 기획 경험",
        seedSentence:
          "삼성전자의 핵심 역량을 활용하여 전장 및 XR 등 신사업 분야에서 새로운 성장 기회를 발굴하고 싶습니다.",
      },
    ],
    interviewPrep: {
      questions: [
        {
          question:
            "최근 삼성전자가 AI 반도체 시장 주도권 확보를 위해 'SAFE 포럼 2026'을 개최하고 2나노 전략을 발표했습니다. 이 전략이 성공하기 위해 전략기획 직무에서 어떤 역할을 해야 한다고 생각하십니까?",
          direction:
            "SAFE 포럼의 의미(생태계 확장, 기술 로드맵 공개)를 언급하고, 전략기획 직무가 시장 분석, 파트너십 발굴, 중장기 투자 계획 수립, 그리고 내부 사업 부문 간 시너지 창출 등의 역할을 통해 파운드리 사업의 경쟁력을 높일 수 있음을 구체적으로 설명합니다.",
        },
        {
          question:
            "이재용 회장께서 HBM 경쟁력 강화를 강조하며 '사즉생' 각오를 언급했습니다. 삼성전자가 HBM 시장에서 1위로 도약하기 위한 가장 중요한 전략은 무엇이라고 생각하며, 본인이 기여할 수 있는 부분은 무엇입니까?",
          direction:
            "HBM 시장의 중요성을 강조하고, 기술 리더십(HBM4 양산), 장기 고객 확보(LTA), 생산 능력 확장, 그리고 파운드리와의 시너지 등 다각적인 전략을 제시합니다. 본인이 시장 분석, 경쟁사 동향 파악, 신규 고객 발굴, 혹은 내부 자원 배분 최적화 등의 역할을 통해 기여할 수 있음을 어필합니다.",
        },
        {
          question:
            "삼성전자가 전장, 공조, XR 등 신사업 분야에 적극적으로 투자하고 있습니다. 이러한 신사업들이 삼성전자의 미래 성장에 어떤 의미를 가지며, 전략기획 관점에서 어떤 점을 가장 중요하게 고려해야 할까요?",
          direction:
            "신사업이 기존 주력 사업의 변동성을 보완하고 새로운 성장 동력을 확보하는 의미를 설명합니다. 전략기획 관점에서는 시장 잠재력 평가, 기존 사업과의 시너지 분석, M&A 및 파트너십 전략 수립, 그리고 투자 리스크 관리 등을 중요하게 고려해야 함을 언급합니다.",
        },
        {
          question:
            "최근 DX 부문 노조 파업 가능성 등 내부 이슈가 발생했습니다. 이러한 이슈가 전사 경영 전략에 미칠 수 있는 영향은 무엇이며, 전략기획 직무에서 이러한 리스크를 어떻게 관리할 수 있을까요?",
          direction:
            "노사 관계 불안정성이 기업 이미지, 생산성, 그리고 장기적인 사업 계획에 미칠 수 있는 부정적 영향을 설명합니다. 전략기획 직무에서는 이러한 리스크를 경영 환경 분석에 포함하고, 비상 계획 수립, 커뮤니케이션 전략 지원, 그리고 지속 가능한 경영을 위한 내부 역량 강화 방안 등을 모색할 수 있음을 제시합니다.",
        },
        {
          question:
            "삼성전자는 '인재와 기술'을 핵심 철학으로 삼고 있습니다. 전략기획 직무에 필요한 '인재상'을 삼성전자의 사업 맥락에서 정의하고, 본인이 그 인재상에 어떻게 부합하는지 설명해 주십시오.",
          direction:
            "범용적인 인재상 단어 대신, AI, 파운드리, HBM 등 삼성전자의 핵심 사업과 연관 지어 '기술적 통찰력', '시장 변화에 대한 민감성', '전략적 사고', '내외부 이해관계자와의 협업 능력' 등을 강조합니다. 본인의 경험을 구체적인 사례와 연결하여 이러한 역량을 갖추고 있음을 보여줍니다.",
        },
        {
          question:
            "글로벌 공급망 불안정성, 지정학적 리스크 등 대외 불확실성이 지속되고 있습니다. 이러한 환경에서 삼성전자의 지속 가능한 성장을 위해 전략기획 직무가 어떤 역할을 해야 한다고 생각하십니까?",
          direction:
            "대외 불확실성이 사업 운영에 미칠 수 있는 영향을 분석하고, 공급망 다변화, 리스크 시나리오 분석, 정부 및 국제 기관과의 협력 방안 모색, 그리고 비상 계획 수립 등을 통해 회사의 안정적인 성장을 지원할 수 있음을 설명합니다.",
        },
        {
          question:
            "삼성전자의 최근 실적 발표를 보면 DS 부문의 성장이 두드러지는 반면, DX 부문은 상대적으로 수익성 개선폭이 제한적이었습니다. 이러한 사업 부문 간의 편차를 줄이고 전사적인 성장을 이끌기 위한 전략기획의 역할은 무엇일까요?",
          direction:
            "각 부문의 실적 편차 원인을 분석하고, DS 부문의 기술 리더십을 DX 부문의 제품 혁신과 연결하는 방안, DX 부문의 고부가 제품 포트폴리오 강화, 그리고 효율적인 자원 배분 및 투자 전략 수립 등을 통해 전사적인 균형 성장을 이 이끌 수 있음을 제시합니다.",
        },
      ],
      primarySources: [
        {
          label: "삼성전자 IR 자료 (분기별 실적 발표)",
          url: "https://www.samsung.com/global/ir/ir-resources/earnings-release/",
        },
        {
          label: "삼성전자 뉴스룸 (최신 소식 및 보도자료)",
          url: "https://news.samsung.com/kr/",
        },
        {
          label: "삼성전자 채용 홈페이지 (직무소개)",
          url: "https://www.samsung.com/careers/kr/career-paths/job-description/",
        },
        {
          label: "금융감독원 전자공시시스템 (DART) - 삼성전자",
          url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000329",
        },
      ],
    },
    sources: [
      {
        id: 1,
        title: "jobkorea.co.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGTFmvHS1fb74uJ56MpjPYuv1ROGLyDT3rVYvItWC90yKG1RDDFVJ9OBkeZ0NCxYQsiJBkQFrh9VI15WeTocgqblqFDAHFHWYHlONCSgWZCHzmBsj6XOJpN9QJr50NOX9xYohR-9zgidcmnPJNmXIvi87eVxmFpgOBSjhvIziZpbFw=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 2,
        title: "industrynews.co.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGw6w6RReJthPNhLJdl8ZAfvh52_5reiKyz3tFa3_L7zjdngcTkPLS21RPhTCx1kswJsCTt5ISrrebkQL97XFpwI7YXT6r0Kq3Ky2_W_cBFf9Lw-wjkAX41KG7am-kqgPfIY3AH_HFovfvtB1SJ67AhdxSQQ3idU1u6pA==",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 3,
        title: "linkareer.com",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEjcG5z51-MYiHtmVtvr4OirEGDWdlt8ArSScLSU_UPlk2F4TlRd7D9BErYPr0dnb_-gOL-ZIcpfKMAIL_SB8vWerw--2Bje_g4f7enJYf1avNSRkDQVyl_8feg9-FPOZ4L5W8=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 4,
        title: "tojaman.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHS4QUdEN9xnKCEerbjhW8tnGUJRvlgsto2xC1rOmruXqqqg7U3k6A3-9P8jFvUdWHiUto2vKhm85TpwEG2e8MMJwnir1n3pyMAvIDPrMdtJVYQ_wK0rzzEK_smK23AGfET-qOUKB_OTZ4swm3VRNcrcrpphSMyqCk=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 5,
        title: "samsungsemiconductor.com",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEhCywinEeU2RHterZEvX3G1zW9j9APYH6-6ztRIK-U-9VAlL6MGHBiommdL8GeD2PF7puTqjICrqwaC4u1Yq8EQAswLzkWaUizL1HaRfzvEr_K2fu_pJnYW95n9JDqIFb0-ej2D2FUuiGxbHsfhkIEQZbTmlFUqI7IMyjXmh6sCCNWJ9ykRMOYKQ_uAKJkolISIpAk0k0jrFTBY6uNiADPyp1Qxecd5PRJQu4Gw1CdZ2VBZMFltsRwGoey_Qd48b6xtuuLCQXREp8IU51IAYGflA==",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 6,
        title: "youtube.com",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEaBf2FwiEC1FMx-akiQR8UkimnCWrRCeULNBLKAFTjqYyqbG7N1sjZgd7D2K0wfy2p_GjMhF-_T6oMnBncwC9RUA_riaMpBqNjiqiiy9uPmOUmJfaxBxE3b2-i-cNreHO8tPKvqg==",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 7,
        title: "ajunews.com",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHK-qnJe-uVtCcinAIqzevfhsSxcMgHWbSn4TnaIE32tfL7DDlIu23-sy-b0qwEKF4wgOYhg7lOWlKVAKJAtZrcXNAkMJenZIUSFRGO2Br471F_v9fzNrI3QzN6sGRKW8dkI1an7zTbZg==",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 8,
        title: "investchosun.com",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQETMNixydQ082I9v3SyuhYZ2H20IoOAv9iZeSz45SJSgS-NFu6fivYJ8KCBvD5xp6UkMraL8RW3YuFKU9OpewJ07PBi4CvV2MRtZRDpbEUwlC0qqpPmEPdXNKHx5SvWuBt4-IpZ0WQ3Ov0NgoePGEV5tdZupy9457xQRT7HnmECeKC6WsoroeM=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 9,
        title: "wisereport.co.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHOKEQvEv7CEz3DTsVjzyTSgKFeBIouCnbyqiEkC_h1fc7T4W-xPdid-IfGCRVBEi8lrOVPu2E-K11BLxAwIuPCplJnnivYfYBy0v68hMzUwwDP3P3H32TlOzslHK1jd5xhXpKLYYABEgtjmrIWmGemd36ccOaO1PTLZwjOFeTM",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 10,
        title: "issuemaker.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH8fCINHJc1odMGKkWPUuofdCauxEOV61CccxDBS5DKLK1KAfJinw2Gl_R78gt-G5a96JH8Yumi2M6AJHBaaYgOFuJfsNO32MFqaTbDtouSx9AvW94if47QOi4ADyry7HDXs8HZmx6rP4vR29fAKXGkBkfte1Q=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 11,
        title: "womentimes.co.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZe2Y7gEQIcfNZ5BpS0paEwQWIhX5D5MJF8RL7kFew0QF2dRnZ5qAP46s0qh6HTlHk-17A33qSjJ3dd5Q8vsX8fv3WmHGY8MPkhHyCAKSAxWwvmvDnMFfVGjol3DXtPawcyqz9D4EG5B1hyA5bRSkJkkIc9sIMe4g=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 12,
        title: "huffingtonpost.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFUUb-e21kR3fhROsdkkuUHPo-X1dqdmh0_RDXmZnv4cxixSFkRiRkZCBj3ANcJsxaNC3krItthwFsW75H7anpShvZqvG1q1-G3GSjDq14zC1f9PVckxkS1PWvRkZvzJk5YqXEPOHk=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 13,
        title: "donga.com",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGQ8WTuw84ptb59QwuxhMv_B58TMIlVBqU1ic4z5SSKzmgq2l4zEsjGRtUNE6-0Iedizbb1AJwcS38c2uInQjmNr-U-cDFSupbCh0_g3x5PDotxDhdf5r9SRNeOeYZleTSavm0QDwj0zIvPpSjH_mscmnrA4jLRGa0HMyagmg==",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 14,
        title: "greened.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFDohDvl9W3er6zJcm7eQuBad0z6QZKye68dxuz3vQ7A6KwBYy0Bwsp6MIrBUbQYVIPEpDTALfvDuO8FSSbDXDhkt9EhDczIId5EHZTPceqIKaFq7GZCOu7xGojDLF9G3J3fzJgrbWPOI_61Kcv5LQ56tuz",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 15,
        title: "elec4.co.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF35PX8kNe88pPR1SKgbO4xz9kdxVZ8lcTLXu8OXagEqKEefCCbUdQcW9xIHMnNTgY-8zvYdl9o2MPh46srtvFRvTekzRUX1Rz9jVGYpryxgrhwPMKoiOjJeHWWUB7qAuGg29tIj2-FqTdf8y8K7BRO-9CdXxmoBA==",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 16,
        title: "aitimes.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwE6iQQ8UPOXRuuIzLvfhwnG2axURmBLN11Ya9tWw2x-v5XCaMbd194Q5QV-FpPB7nReaCEaMJFJigwxzi_DH7KoYacH-NhzZspK302HqjbjJ8TNg8QA7R9NwS1igUNY_CmGNKOZf0d7zSMnXapZpKoQA=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 17,
        title: "mk.co.kr",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpubGPL2Ey7quGt5kGlNfVv4soSZoLF2JSCd1kLTmF9xDpZHZRs2hiNjxLmv8HYwUTNFnYsZRdJ9J3rUbVrddW1iS7ozfsCGFrjwbCKSEHLD3lSkJPsSh_V9QmGN-UQKIkbtZ8Fg==",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 18,
        title: "newstomato.com",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFBnxl8KZfm5EBjeuKWETVoiZxnE5R-GWjKbCZkmb2IjVDB8KFrGT1xxBbimkntSeFZTAzMzar-AF4y26XV1-L2K2oX1BVcxy76zAPabE44FiJZgrndbBhuxHfV5h9MAD9SgLm-O79RvEwEXK4C",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 19,
        title: "daum.net",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGvSrcQBOh2JvlM6XkHFS3W2DXoqxaAjL1kkZyxxuYMDCLf2XfE-dcaHOx-WssLwK0473LikPaiBq7tDEazf8pKxaeSL9o29GyXvcY7be8hnU5yOwag0_laHDHVN0eEbw4=",
        publisher: "vertexaisearch.cloud.google.com",
      },
      {
        id: 20,
        title: "etnews.com",
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGt7Bip_rh1wTg_PHBW5SW0peqKlesS895vFmOtmcJx3IstsDBKLH0FaiSxycxURTg_oQlCBh9zucdlv86uq25B0oZJuiIM8b6T7AlXjFy4BDWmHce1bV5XHcchs2nC7A==",
        publisher: "vertexaisearch.cloud.google.com",
      },
    ],
    reportMeta: {
      kind: "COMPANY",
      schemaVersion: 1,
      asOf: "2026-09-07",
      searchQueries: [
        "삼성전자 사업부문 주력 제품 고객 경쟁사",
        "삼성전자 2024 2025 2026 신사업 투자 조직개편",
        "삼성전자 2024 2025 2026 실적 매출 영업이익",
        "삼성전자 주요 공시 IR 2025 2026",
        "삼성전자 주가 시가총액 2026년 9월",
        "삼성전자 전략기획 조직개편 2025 2026",
        "삼성전자 전략기획 채용 확대 2025 2026",
        "삼성전자 전략기획 직무 관련 프로젝트 2025 2026",
        "삼성전자 주요 이슈 2025 2026",
        "삼성전자 반도체 AI 파운드리 전략 2025 2026",
      ],
      searchEntryPointHtml:
        '<style>\n.container {\n  align-items: center;\n  border-radius: 8px;\n  display: flex;\n  font-family: Google Sans, Roboto, sans-serif;\n  font-size: 14px;\n  line-height: 20px;\n  padding: 8px 12px;\n}\n.chip {\n  display: inline-block;\n  border: solid 1px;\n  border-radius: 16px;\n  min-width: 14px;\n  padding: 5px 16px;\n  text-align: center;\n  user-select: none;\n  margin: 0 8px;\n  -webkit-tap-highlight-color: transparent;\n}\n.carousel {\n  overflow: auto;\n  scrollbar-width: none;\n  white-space: nowrap;\n  margin-right: -12px;\n}\n.headline {\n  display: flex;\n  margin-right: 4px;\n}\n.gradient-container {\n  position: relative;\n}\n.gradient {\n  position: absolute;\n  transform: translate(3px, -9px);\n  height: 36px;\n  width: 9px;\n}\n@media (prefers-color-scheme: light) {\n  .container {\n    background-color: #fafafa;\n    box-shadow: 0 0 0 1px #0000000f;\n  }\n  .headline-label {\n    color: #1f1f1f;\n  }\n  .chip {\n    background-color: #ffffff;\n    border-color: #d2d2d2;\n    color: #5e5e5e;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #f2f2f2;\n  }\n  .chip:focus {\n    background-color: #f2f2f2;\n  }\n  .chip:active {\n    background-color: #d8d8d8;\n    border-color: #b6b6b6;\n  }\n  .logo-dark {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #fafafa 15%, #fafafa00 100%);\n  }\n}\n@media (prefers-color-scheme: dark) {\n  .container {\n    background-color: #1f1f1f;\n    box-shadow: 0 0 0 1px #ffffff26;\n  }\n  .headline-label {\n    color: #fff;\n  }\n  .chip {\n    background-color: #2c2c2c;\n    border-color: #3c4043;\n    color: #fff;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #353536;\n  }\n  .chip:focus {\n    background-color: #353536;\n  }\n  .chip:active {\n    background-color: #464849;\n    border-color: #53575b;\n  }\n  .logo-light {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #1f1f1f 15%, #1f1f1f00 100%);\n  }\n}\n</style>\n<div class="container">\n  <div class="headline">\n    <svg class="logo-light" width="18" height="18" viewBox="9 9 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">\n      <path fill-rule="evenodd" clip-rule="evenodd" d="M42.8622 27.0064C42.8622 25.7839 42.7525 24.6084 42.5487 23.4799H26.3109V30.1568H35.5897C35.1821 32.3041 33.9596 34.1222 32.1258 35.3448V39.6864H37.7213C40.9814 36.677 42.8622 32.2571 42.8622 27.0064V27.0064Z" fill="#4285F4"/>\n      <path fill-rule="evenodd" clip-rule="evenodd" d="M26.3109 43.8555C30.9659 43.8555 34.8687 42.3195 37.7213 39.6863L32.1258 35.3447C30.5898 36.3792 28.6306 37.0061 26.3109 37.0061C21.8282 37.0061 18.0195 33.9811 16.6559 29.906H10.9194V34.3573C13.7563 39.9841 19.5712 43.8555 26.3109 43.8555V43.8555Z" fill="#34A853"/>\n      <path fill-rule="evenodd" clip-rule="evenodd" d="M16.6559 29.8904C16.3111 28.8559 16.1074 27.7588 16.1074 26.6146C16.1074 25.4704 16.3111 24.3733 16.6559 23.3388V18.8875H10.9194C9.74388 21.2072 9.06992 23.8247 9.06992 26.6146C9.06992 29.4045 9.74388 32.022 10.9194 34.3417L15.3864 30.8621L16.6559 29.8904V29.8904Z" fill="#FBBC05"/>\n      <path fill-rule="evenodd" clip-rule="evenodd" d="M26.3109 16.2386C28.85 16.2386 31.107 17.1164 32.9095 18.8091L37.8466 13.8719C34.853 11.082 30.9659 9.3736 26.3109 9.3736C19.5712 9.3736 13.7563 13.245 10.9194 18.8875L16.6559 23.3388C18.0195 19.2636 21.8282 16.2386 26.3109 16.2386V16.2386Z" fill="#EA4335"/>\n    </svg>\n    <svg class="logo-dark" width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">\n      <circle cx="24" cy="23" fill="#FFF" r="22"/>\n      <path d="M33.76 34.26c2.75-2.56 4.49-6.37 4.49-11.26 0-.89-.08-1.84-.29-3H24.01v5.99h8.03c-.4 2.02-1.5 3.56-3.07 4.56v.75l3.91 2.97h.88z" fill="#4285F4"/>\n      <path d="M15.58 25.77A8.845 8.845 0 0 0 24 31.86c1.92 0 3.62-.46 4.97-1.31l4.79 3.71C31.14 36.7 27.65 38 24 38c-5.93 0-11.01-3.4-13.45-8.36l.17-1.01 4.06-2.85h.8z" fill="#34A853"/>\n      <path d="M15.59 20.21a8.864 8.864 0 0 0 0 5.58l-5.03 3.86c-.98-2-1.53-4.25-1.53-6.64 0-2.39.55-4.64 1.53-6.64l1-.22 3.81 2.98.22 1.08z" fill="#FBBC05"/>\n      <path d="M24 14.14c2.11 0 4.02.75 5.52 1.98l4.36-4.36C31.22 9.43 27.81 8 24 8c-5.93 0-11.01 3.4-13.45 8.36l5.03 3.85A8.86 8.86 0 0 1 24 14.14z" fill="#EA4335"/>\n    </svg>\n    <div class="gradient-container"><div class="gradient"></div></div>\n  </div>\n  <div class="carousel">\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFcZFHkiF72h1subsq0f6bbj_liDPgnLT_FzI4njDtYKfEFCoBjlZBI3uh4lkCe0hQEj6ABSrySvAclkDtRq7srhsgp-n4re2Z2JNzN9dKla1uiAZ7WIztJiMQPt_Dc1jdm-pfQZjzY4OBbA-sB7mqjJKkcw12hGrFs0ZrgNoy9RSBuAPtV1Wb14SbI8YnIgY_ICXCIpOhm0tgypuaotKfDZY7tvekTy6iLBRwks5ehpCBboR1DtGyUM4iCewXFMtECMxSj6kdHFuv9jGUlw2YxX2WfLNhoJp1sCJqYo1rz_s7Skb2OSfOYOEEWxogu6tW8LGMmLV9WCEJJQEjzxEnZZTzlEjzFtivFdkhn99AMrWXBtQ8ZsIyy63T8CQ2ykhLB">삼성전자 전략기획 직무 관련 프로젝트 2025 2026</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFD2sPQHrUwWilmyTIJdpOlcBmEzIdCMCwOzjXEYFr2PaKOqNSi_1Ok-7ChCoWWtK6birp6Zqwitz_OQLwElO887mo-UELA3oQX0SMM2OEOb_CaY8MufGVkXm10_GpkOiFJ_sDt1L4q8EaxTRyty2M3sfSuPwnoHvnIEvwTuA5vwGaXBu3Un6fjtv16N1BWAiwRe3RDwz9RhPi1ZmyK7ZIdnmwepptMyaMea6C2R460HKtzaCe7CxJrh7EeStlZLR0Nufh0yiB6JMB_kQgMtxQZkbM2D-smTaiXyg==">삼성전자 주요 공시 IR 2025 2026</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEQRr-2LrTGaaMcgfeY3Y5maub8dnWZBXIbOTDGhUXOs26YwJFKi-UvXeGVGcvbrvoXvsx2HPwF4dnqMQz55NG721BO-6UOzgaUGz2nk2SvwpVxRvKX51b9yd4iBclmOaPgc_r55LssLbDJp82Ox6tYEdD5ipWIiDyBM-uQlqTRFz0EZsfKSBwCad9tp0umNw786uUSKX2-HIWlQdx_qenDiZjS_0owh-WRxA7CHAimlzH0yFWxawluEWXuq_pBLKYSgwFKyXCvFPkiiYUrKNJKMiNdbAG7Edf0Tja9gF0s22fxSufmQwtXBVTWRBOGNCsHsXB7ai_HJUWnUmBstBWXGg==">삼성전자 2024 2025 2026 실적 매출 영업이익</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEAs7X6iJ54KTn5xPehjvBxcPbqev5f7ZWw6v_IcciL1Csh4bdrfCb4nHogewZhYtmZumNxcUYhlVujvUjekY-3vUgbHPmAWl1OWigyXY8l1d9ffcamdpPriXdhAik__auj4YYMvFjINRAPRHo-vPevhdVWYIiUGbuIi3P1MCmdIl8v1lOC16DazcTZhmTTyw23cVCWzZXes4V32dk0vz7oUKO9TQLpMtvWtj3FewTUYrOv23BZlsfkn74dw3IeG7fp5ij4EkryRGCUpgwL3r35O_OClk1yO7bo5en2i4QrACaFHsGngejXwD3xRJTD7vNAOYPrRv6wK5ZYJQ04UIZmkRkI4gX9BAypbpEWWxXT-uYWhctf2QSgTGdlGgiQho-5">삼성전자 사업부문 주력 제품 고객 경쟁사</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHs4hKNzDFO03rPNOUpmuys3aR6b4y_LZpH1cYan1VTtPwLaMHXVmJ1Dnn5WcSR9nfqj4tls5oyI7JIJNJWqQv10DG0uSLwPhYzUILSrzIDIwlQ371NMEF6I3sW393IpndqMx8IOHBslAtZsFs1JHX6byzP3B7OC51fXf8O0AvJHcgiQFxYqARKBLC8mN2TYbZJl6yV-pdRVYOOvBHOSvbGDXsW_ZwQ42Raixr8HklZgHRDenP8CbOccqNeV44dkwoceItKXPQFg6OQSLkwWIJxVolwRn_B2JFSduX5b_mPlWTSTk3RL84fsFgIN-caj9kZCACMv4sg8Yk_gIMCgxlRRPseTYoK21XhCA==">삼성전자 2024 2025 2026 신사업 투자 조직개편</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFjO8q7eo2sI8S0ccFA_mWXStPT79KttH_86BdTg28ljY3iUdSQcFGcwMQHmqvs3y44SUw1wuB3nz7MHRIW_Sjs0O9yQypqRqCC0KVvoMBATGPlpEkz0phTJPODBcpYQhYmSr8VYt-_VYz3Iex3MJ-G_o8ygL117xXOLn08BOqzT43OTx2aVmEy8ZVRFkFmQ6eZGjqsphDIkqsHUNHH-Ako9YNzo2xhPT0_FaCFCktlEc2Zq-mlX7PhRuXYuZpIEQ2EaSVleSDJke_cXZUR6EUDKOPH6pgYJHfZSDBdxB9t64hA8IgJi_nuEvnCblMrbQQ62capqE9Tvg==">삼성전자 주가 시가총액 2026년 9월</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQo_LC6L55B6vnTAKFV8b1-_X9mITKxSwdnucsmEHusahW6M6GW0KMp6GxrTumblgViHQZq9T7HJnXturOuCspAluzBfeIlyJQiDb6KmtTFIQdO0ofUeurcfa8WEvhc1ZmYlCRT0XUvPUwWd64V_-d0EUAxHaMPZdNEl0UuXuHD5aYUkrXPN7LGPYPFjm_Zj7c9indWgaTgP9gFBRldD50FS5MfcMMDp3Lxy2QvEazDbiagYXg1AreHLc3wCVcpgriJ7r_p5PRPCPVhRUfB6ss9sZQv0qtkoeKwJsZm4WNxpXN_VfwohJHL7p-He1tM4ILvI0Toaqn4sob4w==">삼성전자 전략기획 조직개편 2025 2026</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_TQvYE7bOC1_jwhwI89gProo9LqWyaQyYz95CX2Wkb_mdcpA9mKFnbeu2Oh1pyM15U0GKIInwE8eo4HU0Mk66pyvIY9vh0LAPcHSNmIgo0BloLUB1tdtzfYKV3cYyneIUrJ32pJA08PMc-ymeYuQDoprFRnE7xjY3M3yQ9K6O0dx21OhjFilAH8mrcbBrfa9nd7wVwo3gjKrCBx86rLrj7lxVNVRCmk9wFfZfxAza9ZRIpXISkncXfX0OFAJH0RbIj9L3l9fl9khsff-i8T4R0RRTVYEhEgjhfyIhsI2ojFI5fJ81-nMlNn-4yuV7wsyS4cBdDjr85G67cFc=">삼성전자 전략기획 채용 확대 2025 2026</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHuMdwS2MteN6C83XfScpSugP8X41lAlxHjq26Jk5KMHhQCab0W2PZ1SRh9sS6vHaFxzGX5rg1yno5i_iTkGGRAK5zFpHavcplY71kwrUY-31lJCC4kT-vVtxIRkxpATf85SH4wfIo5cPLxtg8qp2Kj6FrapmmQGmUqGvAFo5sjEgApPWWDAwUplQTlJzwt7LXtFyVuAMd8AWdveWCnfrz-jpK1ZaRx5e59GTtS5RXNjKxrK40bvI0u3FTuvg2KWSOGs9k6X6NnjYwChSbQfavEIPJ8hE_Ya1kbcvbuTL_F7IOobO6r3OgETIsO4XmksEhGaqDwOIiUeaBgZ89-6urTrmRluJVGuvc=">삼성전자 반도체 AI 파운드리 전략 2025 2026</a>\n    <a class="chip" href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHl_EU6FTn_qjMxDZw-n0fYULR9sw39W4MSE6-LA_vIEUX8jvVmAiBUTCBPSrldYW1M2dr_hQoM9X8DWcnIxc-wB8hWkVQNEkm0FLHakyqtjNSLtnqRqXyiIR9wBYJjlVU2kt0HUZv1am4y9XmTx4udQk7kM3nMkJAyOnHgebegiy_ws-9heXsUQEQZAmyKFk7sLLwKXFpT8vCZEfTbRhczOPPjnVVVAVDJIxu2UmgS535NYPGPprgKE2rYPSyUMVyKhyEgiLvCubVWH5Afs5y4mCGRXVXK2A==">삼성전자 주요 이슈 2025 2026</a>\n  </div>\n</div>\n',
      linkedResumeAnalysisId: null,
      repaired: false,
    },
  },
};
