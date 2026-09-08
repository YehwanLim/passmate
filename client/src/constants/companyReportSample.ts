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
    "brief": {
      "oneLiner": "글로벌 전자 산업을 선도하는 반도체, 모바일, 가전 기업",
      "keywords": [
        "반도체",
        "인공지능",
        "모바일",
        "가전",
        "파운드리",
        "HBM"
      ],
      "asOf": "2026-09-08",
      "positionInIndustry": "삼성전자는 메모리 반도체, 스마트폰, TV 시장에서 세계 선두를 유지하고 있으며, 인공지능(AI) 시대의 핵심인 고대역폭메모리(HBM)와 파운드리 기술 경쟁력 강화를 통해 글로벌 기술 패권 경쟁을 주도하고 있습니다."
    },
    "businessMap": {
      "summary": "삼성전자는 크게 반도체 중심의 DS(Device Solutions) 부문과 완제품 중심의 DX(Device eXperience) 부문으로 나뉘어 수익을 창출합니다. DS 부문은 메모리, 시스템LSI, 파운드리 사업으로 기술 주도권을 확보하고 있으며, DX 부문은 스마트폰, TV, 가전 등 다양한 제품으로 소비자 시장을 공략합니다.",
      "segments": [
        {
          "name": "DS (Device Solutions) 부문",
          "whatItDoes": "DRAM, NAND 플래시 등 메모리 반도체와 모바일AP, 이미지센서 등 시스템LSI, 그리고 반도체 위탁 생산인 파운드리 사업을 영위하며, 인공지능 시대의 핵심 부품을 공급합니다.",
          "weight": "최근 실적 개선을 주도하며 전사 영업이익의 상당 부분을 차지하고 있습니다.",
          "phase": "성장",
          "sourceIds": [
            5,
            16,
            20,
            36,
            46
          ]
        },
        {
          "name": "DX (Device eXperience) 부문",
          "whatItDoes": "갤럭시 스마트폰, 태블릿, 웨어러블 기기를 포함한 모바일(MX) 사업과 TV, 모니터 등 영상디스플레이(VD), 냉장고, 세탁기 등 생활가전(DA) 사업을 통해 소비자에게 다양한 경험을 제공합니다.",
          "weight": "전사 매출의 큰 비중을 차지하지만, 최근 부품 가격 상승 등의 영향으로 DS 부문 대비 수익성은 상대적으로 부진했습니다.",
          "phase": "성숙",
          "sourceIds": [
            5,
            13,
            16,
            20,
            21,
            37,
            45
          ]
        },
        {
          "name": "SDC (Samsung Display Corporation)",
          "whatItDoes": "스마트폰, TV 등에 사용되는 OLED 및 QD-OLED 패널을 생산하며, 차세대 디스플레이 기술 개발을 통해 시각 경험 혁신을 추구합니다.",
          "weight": "전사 매출에 기여하며 특히 하이엔드 모바일 제품 수요에 따라 실적이 개선되고 있습니다.",
          "phase": "성장",
          "sourceIds": [
            5,
            37
          ]
        },
        {
          "name": "HARMAN (하만) 부문",
          "whatItDoes": "전장 부품(디지털 콕핏, 카 오디오 등) 및 오디오 제품을 통해 자동차와 라이프스타일 분야에서 사업을 확장하고 있습니다.",
          "weight": "전장 매출 확대와 포터블 오디오 판매 호조로 실적이 개선되고 있습니다.",
          "phase": "성장",
          "sourceIds": [
            5,
            37
          ]
        }
      ],
      "customersAndCompetitors": "주요 고객은 글로벌 IT 기업(반도체), 통신사(스마트폰), 그리고 전 세계 일반 소비자(가전)입니다. 반도체 분야에서는 TSMC, SK하이닉스, 마이크론, 인텔, 퀄컴, 엔비디아 등과 경쟁하며, 스마트폰 시장에서는 애플, 샤오미 등과, 가전 시장에서는 LG전자, 월풀 등과 경쟁합니다."
    },
    "focusBusinesses": {
      "statedDirection": "삼성전자는 '끊임없는 혁신과 Intelligence를 통한 미래 창조'를 비전으로 삼고 있으며, 인공지능(AI)과 로봇을 미래 핵심 성장 동력으로 육성하여 새로운 고객 가치를 창출하고 글로벌 시장을 선도하겠다는 강력한 의지를 밝히고 있습니다.",
      "items": [
        {
          "name": "AI 반도체 (HBM 및 파운드리)",
          "whatChanged": "고대역폭메모리(HBM) 시장 점유율을 빠르게 확대하고 있으며, AI 반도체 생산을 위한 최첨단 파운드리 공정 기술 개발과 '원스톱 AI 솔루션' 제공 전략을 강화하고 있습니다.",
          "evidence": "2026년 2분기 HBM 시장 점유율 33%를 기록하며 1분기 대비 12%p 상승했고, HBM4 양산 출하 및 7세대 HBM(HBM4E) 12단 샘플을 고객사에 공급했습니다. 또한, 2027년 2나노 공정 양산 및 후면전력공급 기술 도입 계획을 발표했습니다.",
          "whyNow": "생성형 AI 기술 발전과 데이터센터 투자 확대로 고성능, 저전력 AI 반도체 수요가 폭발적으로 증가하고 있어, 이 시장을 선점하는 것이 미래 성장의 핵심 동력이기 때문입니다.",
          "relevanceToRole": "직접. AI 반도체 시장의 급격한 성장과 기술 경쟁 심화는 삼성전자의 중장기 전략 수립에 가장 중요한 요소 중 하나입니다.",
          "sourceIds": [
            9,
            10,
            12,
            15,
            17,
            31,
            39,
            44
          ]
        },
        {
          "name": "로봇 사업 본격화",
          "whatChanged": "로봇을 미래 성장 동력의 핵심 축으로 육성하기 위해 대표이사 직속 'RX사업추진실'을 신설하고 중장기 로봇 전략 수립부터 사업화까지 전 과정을 총괄하도록 했습니다.",
          "evidence": "2026년 7월 21일 RX사업추진실 출범을 발표했으며, 2024년 12월 로봇 기업 레인보우로보틱스 인수 및 미래로봇추진단 구성을 통해 로봇 사업에 대한 투자를 이어왔습니다.",
          "whyNow": "인구 고령화와 노동력 부족 문제 심화, 그리고 생성형 AI 및 대규모 행동 데이터 학습 기술의 발전이 로봇 산업의 핵심 경쟁력으로 부상하면서 새로운 사업 기회를 창출할 수 있기 때문입니다.",
          "relevanceToRole": "직접. 로봇 사업은 삼성전자의 새로운 성장 동력으로, 사업 초기 단계부터 시장 분석, 전략 방향 설정, 파트너십 구축 등 전반적인 전략 기획 역량이 중요합니다.",
          "sourceIds": [
            2,
            7,
            14
          ]
        },
        {
          "name": "AI 대전환 (AI Transformation)",
          "whatChanged": "이재용 회장의 주문에 따라 전 관계사의 모든 업무에 AI를 전면 도입하고, 일하는 방식을 AI 중심으로 전환하는 'AI 대전환'을 추진하고 있습니다.",
          "evidence": "2026년 6월부터 DX 부문 임직원을 대상으로 챗GPT, 제미나이, 클로드 등 외부 생성형 AI 서비스를 공식 도입했으며, 전 관계사에 AI 전담 조직을 신설할 계획입니다.",
          "whyNow": "글로벌 산업 패러다임이 AI 중심으로 재편되는 상황에서, 기업의 경쟁력 확보와 지속적인 성장을 위해 업무 효율성 극대화 및 혁신적인 조직 DNA 구축이 필수적이기 때문입니다.",
          "relevanceToRole": "직접. 전사적인 AI 대전환은 전략 기획 직무가 회사의 비전과 목표를 달성하기 위해 AI 기술을 어떻게 활용하고 내재화할지 고민하고 실행하는 데 핵심적인 역할을 요구합니다.",
          "sourceIds": [
            22,
            26
          ]
        }
      ],
      "translatedTalentKeywords": [
        {
          "stated": "Passion (열정)",
          "meaning": "미래 기술 혁신과 시장 선도를 위해 끊임없이 도전하고, 난관에 부딪혔을 때 포기하지 않고 해결책을 찾아내는 집념"
        },
        {
          "stated": "Creativity (창의혁신)",
          "meaning": "기존의 틀을 깨고 새로운 아이디어와 접근 방식으로 인공지능, 로봇 등 미래 사업 분야에서 차별화된 가치를 창출하는 능력"
        },
        {
          "stated": "Integrity (인간미·도덕성)",
          "meaning": "기술과 사업의 윤리적 책임감을 바탕으로 고객과 사회에 긍정적인 영향을 미치며, 투명하고 신뢰할 수 있는 방식으로 업무를 수행하는 자세"
        }
      ]
    },
    "financialSnapshot": {
      "listed": true,
      "market": "유가증권시장 · 삼성전자",
      "revenueTrend": "2026년 상반기 매출은 304조 8,730억 원으로 전년 동기 대비 98.3% 성장했으며, 2분기 매출은 171조 원을 기록하며 역대 최대 분기 매출을 달성했습니다.",
      "profitTrend": "2026년 상반기 영업이익은 146조 6,330억 원으로 전년 동기 대비 1190.6% 급증했으며, 특히 2분기 영업이익은 89조 4,000억 원으로 역대 최대치를 기록했습니다. 이는 AI 인프라 투자 확대에 따른 반도체 수요 증가와 메모리 가격 강세가 주도한 결과입니다.",
      "keyFigures": [
        {
          "label": "매출",
          "value": "171조 원",
          "period": "2026년 2분기",
          "sourceIds": [
            20,
            36
          ]
        },
        {
          "label": "영업이익",
          "value": "89조 4,000억 원",
          "period": "2026년 2분기",
          "sourceIds": [
            20,
            36
          ]
        },
        {
          "label": "시가총액",
          "value": "1,516조 원",
          "period": "2026년 9월",
          "sourceIds": [
            38
          ]
        }
      ],
      "marketView": "2026년 9월 초, 삼성전자의 주가는 글로벌 AI 모델 '아스트라' 공개에 따른 고용량 메모리 반도체 수요 기대감으로 상승세를 보였습니다. 시장은 HBM 수요 확대와 메모리 업황 성장에 주목하며 목표주가를 상향 조정하는 분위기입니다.",
      "recentDisclosures": [
        {
          "title": "2026년 2분기 실적 발표",
          "when": "2026-07",
          "sourceIds": [
            37
          ]
        },
        {
          "title": "기업가치 제고 계획 발표 (시설·R&D 110조 이상 투자)",
          "when": "2026-03",
          "sourceIds": [
            18,
            25,
            27,
            35
          ]
        }
      ],
      "fundingNote": "",
      "forApplicant": "**삼성전자의 역대급 실적과 대규모 투자는 회사가 현재 강력한 성장 모멘텀을 가지고 있으며, 특히 AI 반도체와 같은 미래 핵심 사업에 공격적으로 자원을 배분하고 있음을 보여줍니다.** 이는 전략 기획 직무 지원자에게 회사의 성장 가능성과 함께 도전적인 과제 해결 기회가 많음을 시사합니다."
    },
    "currentIssues": [
      {
        "title": "HBM 시장 경쟁 심화",
        "when": "2026-09",
        "fact": "2026년 2분기 글로벌 HBM 시장에서 삼성전자의 매출 기준 점유율은 33%로 SK하이닉스(50%)에 이어 2위를 기록했으며, 1분기 대비 점유율 격차를 좁혔습니다.",
        "whyItMatters": "HBM은 AI 시대의 핵심 반도체로, 이 시장에서의 주도권 확보는 삼성전자 DS 부문의 장기적인 경쟁력과 수익성에 결정적인 영향을 미칩니다.",
        "forApplicant": "전략 기획 직무는 HBM 시장의 경쟁 구도를 면밀히 분석하고, 기술 로드맵과 시장 전략을 수립하여 초격차를 확보하는 방안을 모색해야 합니다.",
        "sourceIds": [
          17,
          31,
          39,
          44
        ]
      },
      {
        "title": "파운드리 시장 점유율 확대",
        "when": "2026-09",
        "fact": "삼성전자 파운드리 사업부가 테슬라, 브로드컴 등 미국 빅테크 기업으로부터 대형 수주를 받으며 미국 텍사스주 테일러 파운드리 팹이 시범 가동 전부터 생산 예약을 마쳤습니다.",
        "whyItMatters": "파운드리 시장은 AI 반도체 생산의 핵심 축으로, TSMC가 장악한 시장에서 점유율을 확대하는 것은 삼성전자의 시스템 반도체 경쟁력 강화와 사업 다각화에 중요합니다.",
        "forApplicant": "전략 기획 직무는 파운드리 사업의 고객사 확보 전략, 기술 로드맵, 그리고 글로벌 생산 거점 운영 계획을 수립하여 시장 내 입지를 강화하는 데 기여할 수 있습니다."
      },
      {
        "title": "전사적 AI 대전환 추진",
        "when": "2026-06",
        "fact": "삼성전자는 2026년 6월부터 DX 부문 임직원을 대상으로 챗GPT, 제미나이, 클로드 등 외부 생성형 AI 서비스를 공식 도입하고, 전 관계사에 AI 전담 조직을 신설할 계획을 발표했습니다.",
        "whyItMatters": "이는 단순히 업무 효율성을 넘어, 삼성전자의 모든 사업 영역에서 AI를 활용한 혁신을 가속화하고 'AI Native 기업'으로의 전환을 통해 미래 경쟁력을 확보하려는 전략적 움직임입니다.",
        "forApplicant": "전략 기획 직무는 AI 기술을 활용한 새로운 비즈니스 모델 발굴, 기존 업무 프로세스 혁신 방안 수립, 그리고 전사적인 AI 역량 강화를 위한 전략적 방향을 제시하는 역할을 수행해야 합니다."
      },
      {
        "title": "미래 성장 동력 투자 확대",
        "when": "2026-03",
        "fact": "삼성전자는 2026년 시설 및 R&D에 110조 원 이상을 투자하고, 첨단 로봇, 메드테크, 전장, HVAC 등 미래 유망 분야에서 의미 있는 규모의 M&A를 추진할 계획을 발표했습니다.",
        "whyItMatters": "이는 기존 주력 사업의 경쟁력을 유지하면서도, 새로운 성장 동력을 발굴하고 확보하여 지속 가능한 기업 성장을 이루기 위한 핵심 전략입니다.",
        "forApplicant": "전략 기획 직무는 이러한 신사업 분야의 시장 동향을 분석하고, 투자 및 M&A 대상을 발굴하며, 사업 포트폴리오를 다각화하는 중장기 전략을 수립하는 데 중요한 역할을 합니다."
      }
    ],
    "roleInContext": {
      "whereItSits": "전략기획 직무는 주로 전사 전략을 담당하는 경영지원실 또는 각 사업부의 기획팀에 배치될 가능성이 높습니다. 특히 DS 부문이나 DX 부문의 미래 성장 동력 발굴 및 사업 포트폴리오 재편과 관련된 전략 수립에 참여할 수 있습니다.",
      "problemsItSolves": [
        "글로벌 시장 및 경쟁사 동향을 분석하여 중장기 사업 전략 수립을 위한 기초 자료를 조사하고 보고합니다.",
        "신사업 기회 발굴을 위한 시장성 분석, 기술 트렌드 예측, 잠재적 파트너사 검토 등의 업무를 수행합니다.",
        "기존 사업의 수익성 개선 및 효율성 증대를 위한 전략적 과제를 도출하고 실행 계획을 지원합니다.",
        "M&A, 투자 등 주요 의사결정을 위한 재무 및 비재무적 데이터를 분석하고 보고서를 작성합니다."
      ],
      "whyHiringNow": "삼성전자가 AI, 로봇 등 미래 핵심 사업으로의 전환을 가속화하고 글로벌 기술 패권 경쟁에서 우위를 점하기 위해 전사적인 관점에서 새로운 성장 전략을 수립하고 실행할 인재를 필요로 하는 것으로 보입니다.",
      "recentNewsForRole": [
        {
          "title": "삼성전자, 메모리 한계 넘는 CUBE 전략 공개…AI 시대 주도권 굳힌다",
          "when": "2026-09",
          "fact": "삼성전자가 차세대 메모리의 용량과 대역폭을 대폭 끌어올리고 발열 문제를 개선하는 'CUBE' 전략을 공개하며 AI 메모리 시대 주도권 강화를 선언했습니다.",
          "whyForRole": "이 소식은 전략기획 직무가 AI 메모리 시장의 기술 표준과 경쟁 구도를 이해하고, 삼성전자의 기술 리더십을 바탕으로 한 시장 확대 전략을 어떻게 수립할지 고민하는 데 중요한 맥락을 제공합니다.",
          "sourceIds": [
            10
          ]
        },
        {
          "title": "삼성전자, 미래 성장동력 로봇 사업 본격화...대표이사 직속 'RX사업추진실' 신설",
          "when": "2026-07",
          "fact": "삼성전자가 로봇을 미래 성장동력의 핵심 축으로 육성하기 위해 대표이사 직속 'RX사업추진실'을 출범하고 중장기 로봇 전략 수립부터 사업화까지 전 과정을 총괄하도록 했습니다.",
          "whyForRole": "전략기획 직무는 로봇 사업의 초기 시장 분석, 성장 전략 수립, 생태계 구축 방안 등 새로운 사업 영역의 전반적인 전략 방향을 설정하는 데 핵심적인 역할을 수행할 수 있습니다.",
          "sourceIds": [
            2
          ]
        },
        {
          "title": "챗GPT 막았던 삼성, 생성형 AI 3종 전면 도입… AX 속도 낸다",
          "when": "2026-06",
          "fact": "삼성전자 DX부문이 임직원을 대상으로 챗GPT, 제미나이, 클로드 등 외부 생성형 AI 서비스를 공식 도입하며 전사적인 'AI 대전환(AX)'에 본격 나섰습니다.",
          "whyForRole": "이 소식은 전략기획 직무가 AI 기술을 활용하여 업무 효율성을 높이고, 새로운 비즈니스 기회를 발굴하며, 전사적인 AI 역량을 강화하기 위한 전략적 접근 방안을 모색하는 데 중요한 시사점을 줍니다.",
          "sourceIds": [
            26
          ]
        }
      ],
      "postingReading": ""
    },
    "opportunitiesAndRisks": {
      "opportunities": [
        {
          "headline": "AI 시대 반도체 리더십 강화",
          "text": "고대역폭메모리(HBM) 시장에서 점유율을 빠르게 확대하고 있으며, 최첨단 파운드리 기술 개발을 통해 AI 반도체 생산의 핵심 파트너로 부상하고 있습니다. **메모리, 시스템LSI, 파운드리, 패키징을 아우르는 '원스톱 AI 솔루션'은 삼성전자만의 독보적인 경쟁 우위입니다.**",
          "sourceIds": [
            10,
            15,
            18,
            25,
            39,
            44
          ]
        },
        {
          "headline": "신사업 발굴 및 투자 가속화",
          "text": "로봇 사업을 미래 성장 동력으로 본격화하고, 메드테크, 전장 등 유망 분야에서의 M&A를 추진하며 사업 포트폴리오를 다각화하고 있습니다. **이는 기존 주력 사업을 넘어선 새로운 성장 기회를 적극적으로 모색하는 전략적 방향성을 보여줍니다.**"
        },
        {
          "headline": "전사적 AI 역량 내재화",
          "text": "모든 업무에 AI를 도입하는 'AI 대전환'을 추진하며, 임직원의 AI 활용을 장려하고 전담 조직을 신설하여 기업 전반의 혁신을 가속화하고 있습니다. **AI를 통한 업무 효율성 증대와 새로운 비즈니스 모델 창출은 삼성전자의 미래 경쟁력을 한층 강화할 것입니다.**"
        }
      ],
      "risks": [
        {
          "headline": "글로벌 경기 변동성 심화",
          "text": "반도체 산업은 글로벌 경기 변동에 민감하며, 지정학적 리스크와 거시 경제 불확실성은 수요 감소 및 가격 하락으로 이어질 수 있습니다. **이는 삼성전자의 실적에 직접적인 영향을 미칠 수 있는 외부 요인입니다.**"
        },
        {
          "headline": "경쟁사의 기술 추격 및 견제",
          "text": "HBM, 파운드리 등 핵심 사업 분야에서 SK하이닉스, TSMC 등 경쟁사들의 기술 추격과 투자 확대가 지속되고 있습니다. **기술 초격차를 유지하고 시장 점유율을 방어하기 위한 끊임없는 혁신이 요구됩니다.**"
        },
        {
          "headline": "신사업의 불확실성 및 실행 리스크",
          "text": "로봇, 메드테크 등 신사업은 높은 성장 잠재력을 가지지만, 초기 투자 비용과 기술 상용화의 불확실성이 존재합니다. **성공적인 시장 안착과 수익 창출을 위한 면밀한 전략 수립과 실행 역량이 중요합니다.**"
        }
      ]
    },
    "businessCandidates": [
      {
        "name": "AI 기반 온디바이스 솔루션 확대",
        "whyForThisRole": "삼성전자는 AI 폰 갤럭시 S24를 시작으로 AI 가전 등을 선보이며 온디바이스 AI 생태계 구축에 나서고 있습니다. 전략기획 직무는 AI 기술을 활용한 새로운 제품 및 서비스 기획, 기존 제품의 AI 기능 고도화 전략을 수립하는 데 중요한 역할을 할 수 있습니다.",
        "angle": "온디바이스 AI 기술이 소비자의 일상에 어떤 혁신적인 가치를 제공할 수 있을지, 그리고 이를 통해 삼성전자가 어떻게 새로운 시장을 창출하고 주도할 수 있을지에 대한 전략적 관점",
        "experienceToPrepare": "AI 기술 트렌드 분석, 소비자 행동 데이터 기반 신규 서비스 기획 프로젝트, 스마트 기기 사용성 개선 아이디어 제안 경험",
        "seedSentence": "온디바이스 AI가 제공할 수 있는 개인화된 사용자 경험을 극대화하기 위한 제품-서비스 연동 전략"
      },
      {
        "name": "첨단 패키징 기술 기반 AI 반도체 경쟁력 강화",
        "whyForThisRole": "삼성전자는 메모리, 파운드리, 선단 패키징을 모두 갖춘 유일한 회사로서, AI 반도체 시대에 '원스톱 솔루션'을 제공하며 주도권을 확보하려 합니다. 전략기획 직무는 첨단 패키징 기술을 활용한 AI 반도체 솔루션 차별화 전략, 고객 맞춤형 솔루션 제공 방안 등을 기획하는 데 기여할 수 있습니다.",
        "angle": "HBM과 파운드리 기술을 결합한 첨단 패키징 솔루션이 AI 칩 성능 향상과 전력 효율 개선에 어떻게 기여할 수 있을지, 그리고 이를 통해 고객사의 AI 개발 속도를 어떻게 가속화할 수 있을지에 대한 전략적 접근",
        "experienceToPrepare": "반도체 기술 동향 분석, 공급망 최적화 프로젝트, 기술 기반 신제품 개발 기획 참여 경험",
        "seedSentence": "첨단 패키징 기술을 통해 AI 반도체 시장에서 삼성전자의 차별화된 경쟁 우위를 확보하기 위한 전략"
      },
      {
        "name": "로봇 사업의 시장 진입 및 생태계 확장",
        "whyForThisRole": "삼성전자는 RX사업추진실 신설을 통해 로봇 사업을 본격화하고 있습니다. 전략기획 직무는 로봇 시장의 성장 가능성을 분석하고, 삼성전자의 강점(반도체, AI, 가전 등)을 활용하여 어떤 로봇 제품/서비스로 시장에 진입할지, 그리고 장기적인 로봇 생태계를 어떻게 구축할지에 대한 전략을 수립하는 데 핵심적인 역할을 할 수 있습니다.",
        "angle": "삼성전자가 보유한 AI, 반도체, 가전 기술 역량을 로봇 사업에 접목하여 어떤 혁신적인 로봇 솔루션을 제공하고, 이를 통해 새로운 고객 가치를 창출할 수 있을지에 대한 전략적 시각",
        "experienceToPrepare": "신기술 기반 신사업 기획 프로젝트, 시장 세분화 및 타겟 고객 분석, 기술 파트너십 발굴 경험",
        "seedSentence": "삼성전자의 기술 역량을 활용하여 로봇 시장에서 차별화된 경쟁력을 확보하고 새로운 가치를 창출하기 위한 전략"
      }
    ],
    "interviewPrep": {
      "questions": [
        {
          "question": "최근 삼성전자가 AI 반도체 시장에서 HBM 점유율을 빠르게 확대하고 있습니다. 이러한 변화가 삼성전자의 중장기 사업 전략에 어떤 영향을 미칠 것이라고 생각하십니까?",
          "direction": "HBM 시장의 중요성과 삼성전자의 기술적 강점(CUBE 전략, 원스톱 솔루션 등)을 연결하여 설명하고, 이것이 DS 부문 전반의 성장 동력 및 회사 전체의 AI 리더십 강화에 어떻게 기여할지 구체적으로 답변해야 합니다."
        },
        {
          "question": "삼성전자가 대표이사 직속으로 RX사업추진실을 신설하며 로봇 사업을 본격화하고 있습니다. 전략기획 직무로서 이 신사업의 성공적인 시장 안착을 위해 어떤 전략적 접근이 필요하다고 보십니까?",
          "direction": "로봇 시장의 특성, 삼성전자의 기존 사업과의 시너지 가능성, 그리고 초기 시장 진입 전략(예: 특정 분야 집중, 파트너십 활용 등)에 대한 본인의 아이디어를 제시하고, 이를 위한 구체적인 기획 방안을 설명해야 합니다."
        },
        {
          "question": "삼성전자가 전사적인 'AI 대전환'을 추진하며 업무 방식에 생성형 AI를 도입하고 있습니다. 전략기획 직무로서 이러한 AI 전환이 본인의 업무에 어떤 영향을 미칠 것이며, 어떻게 활용할 수 있을지 설명해 주십시오.",
          "direction": "AI가 전략 수립 과정(데이터 분석, 시장 예측, 보고서 작성 등)의 효율성을 높이고 새로운 관점을 제공할 수 있음을 언급하고, 본인이 AI 도구를 활용하여 어떤 혁신적인 기획을 할 수 있을지 구체적인 아이디어를 제시해야 합니다."
        },
        {
          "question": "삼성전자가 2026년 대규모 시설 및 R&D 투자를 계획하고 있으며, 미래 유망 분야 M&A도 추진하고 있습니다. 전략기획 직무로서 이러한 대규모 투자의 우선순위를 설정하거나 M&A 대상을 발굴할 때 가장 중요하게 고려해야 할 요소는 무엇이라고 생각하십니까?",
          "direction": "회사의 핵심 역량 강화, 미래 성장 동력 확보, 시장 선도 가능성, 재무적 타당성 등 다양한 관점을 제시하고, 각 요소의 중요성을 논리적으로 설명해야 합니다."
        },
        {
          "question": "최근 삼성전자의 2분기 실적이 역대 최대치를 기록하며 반도체 부문이 성장을 견인했습니다. 이러한 실적 개선이 지원하는 전략적 유연성 또는 새로운 기회는 무엇이라고 생각하십니까?",
          "direction": "실적 개선이 신사업 투자 여력 확대, R&D 강화, 인재 확보 등 회사 전반의 전략적 선택지를 넓혀준다는 점을 언급하고, 이를 통해 어떤 분야에서 더 공격적인 전략을 펼칠 수 있을지 연결하여 설명해야 합니다."
        }
      ],
      "primarySources": [
        {
          "label": "삼성전자 IR 자료",
          "url": "https://www.samsung.com/global/ir/main/"
        },
        {
          "label": "삼성전자 뉴스룸",
          "url": "https://news.samsung.com/kr/"
        },
        {
          "label": "삼성전자 반도체 뉴스룸",
          "url": "https://semiconductor.samsung.com/kr/newsroom/"
        },
        {
          "label": "삼성전자 채용 페이지 (인재상)",
          "url": "https://www.samsung.com/sec/aboutsamsung/careers/talent-culture/"
        }
      ]
    },
    "sources": [
      {
        "id": 1,
        "title": "a-ha.io",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzS2FED8IQ5iVM8nodCSqMahEPWC4OIaA82m7z6hjTAc6r0NiVMeUm8uj9fy93Je1I9kAlIKg-7_H5wFwMSAg8o8uw3cEjQDG5UHmAP57F3N96diyY1QHa453m1qXotXEMitlynttttaIfqRZuv0cJRRb56w8kOyJr",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 2,
        "title": "youtube.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGSTfXHTznoeBB-nYF1wCuvIsS5b745HbDztprqLMiZGZvvuu-1RK-7En-IYSHMopIZ334x13VvhZ7VuzWIerukFDMMKPqpjKh8BusZxJrTnD4NHeNQtsbQttYfkuiGZ5t25saJW28=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 3,
        "title": "tistory.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEU4F_AXz0M0NTlFJncEPaP2VMRdYHVWwmdftxHAYZkmy11PzrkAU3vHCmk0EYmFdTpJRDlD9Tmmz_AP7pp2yt_mW1TnjQ5_EaMDgibOtTuGtwZ5ioIq2ASjQErZ-YmtXNJ7sbwZhna7DqJtx6uknrdNLqKmPojwj5eb1SsEcTMJXkBCU8_khB4dyoXI2_rDLGvdN2JkcWQdLzKik6ikypA8YgQsvrKwFcKnGncf1tO8cycUK-9p2PndYdKfu_OrZsOHsomyU9g5i9eiNFz3uyWtXfg4MsI4ucpScML0nk2PSPnAMDnC06S3mYUjHuitN-qINcBkabCvHBYtDOiUnIhQUTK4y-QQ71xNwb0gKUdWiqGZ_jX676lDPkeEcYubzC8nLfYTz08JLIZcr9SGjfL9PzPeevkBrQIFuZ1QT7CYLve2qLl0_JD1cPOmJWHqiJFd-Fcr6_i2uIcjGM8S1pqVjFazzqQDwTX2981",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 4,
        "title": "tistory.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFJXbaLxwGwgCOmG0l83ktf59FX2VpYxTM31hG5pKUjhu8wLPZNmW6EXcV3SLNHD9t9VXbftIIfsF64-ef5bAVTwzJnxrMeJse1yNC3PARWWqp8tzZ2s_QZ-mIFU3JUcKGGde0xG4_ubapFHsQIPsjn1CFWpEBSAjes8BH6yBMwSPqN75zVOUdnR72Fqm4EZWcPytLl157hHYVR6nIsPxe6jU6Rls5ZvOXBFsGBJVIStLf7JPRDpyz2dDDgqPbdhE1_D30LPg2ZhZ292lCIdnVyw1BXkABT4aH8_HXrhdctV48Nw4ZnY7gijQ==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 5,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGYSM0W940zsxq3FfuH6F5hSNXQ7P9rhq5NEr6Tqy_JmrNslgoYf-H0m_3IkkSnXCoWVzvFD4nmSyXEYn8S3VTai2e2rXkV_jjzMfcpX1tr6xDYqPW5CO1Nn0Li4JYDSNWQ8OO9unwP3jm7vqsFiA==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 6,
        "title": "tistory.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHkWp1SHr65G3JjfaNv4E11OvBp0jGg9fZ9dzoW5-TcctDXrwxrMZs754S9qnB6y3MiM-ZU6dwz7Jp7J2OesZCYv47BynMJTt3RMf4LT5uJw4ZtLDOcyhoJ7MEU_x2gQBbXwWb03lHYp8ekCgSQysDl974Yi3ZteeDls7Isj8T5zFQasGdpeWY3PL8z2vqVI3wF8RGEPEX6J7aDNeJo7d_2Ny-Rs3dUDW-rHZKbjImTqWawAO5gV0sQq2_O6OL17tptNTIQqo-tLOXlGC2DfrV1s5vU8KW8M9_PwCK_mUPH8BDZIqk-lg==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 7,
        "title": "wikipedia.org",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEE6iGfkZgro5kQMJ3cgJ3LRNXx5DEnavO9zoEB6oQw5jSOGPNRqv_T6GpikdZ948u4mUTHCiclwLBiDm43JM8PR_xjB3SubgMMlkoM-Ts4eA1LImwc6RjG9ONVhnn4fnR5cM_9nvzkhZB2VaI7dQ3PjWl4UwpyJOiRX1atiQ==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 8,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFoCZZbqhV3jZzsePV2-UxQKjZg0vHFNw3c-lvizIgQ6Pv2ktg5Esy9scqRs5sD1NGcLjff84JBzwIDjYGIr6JFir3HAGJf53yUDag8W1tJBYdkfdAdjiddgEqn29N2x38=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 9,
        "title": "youtube.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFRddmYB5gRE3cz57LZ0TxmleYREJ3p5cLUPOFbXZxh9YyfYz8OwAu79FCjcgAK22YfYxeuiWSuNLllQYUQTvHZdSPAtotWf9FhYrJl2aPdOUpJAT_mRfjyA695VYD7eg71fNGC_vM=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 10,
        "title": "news1.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3TDiNnlGduhIW3h25D6-N0kBIMimJmQLpY2TZOkdNdizjdG-KxrbqzZYjgtH57XppMbc-NRzmRvg6w4NS1ucaHS5ONesCYbM4NtS7IX0h8RbX6wWDJTL48VvBVXlKDFFoerSXyIB4tJaVm-KiQ4NwEA==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 11,
        "title": "namu.wiki",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvolWL9Q-dcZTl10PmTYvbQrNVPW80AauQpUtuLwjKHKZOf1UQYIyTi8UkdDvcNVimvoS-Ihl-hcFtu4bDZ1m6PMpm9TJohHM5Bfd0T9iw1cArV9wiWDiuDoglavF1vQ3rOhhdkfzbyW7poMKpxo51p0JCyVqMeDA3cWnQ7eX5Kr8m_KeTrQ==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 12,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFpFIIqsPN5IS8U6AlFm8lRdfhL450_oVAb-DfKnGwtOhKGzf1eKOC6l_kfHw1pDlifXbhzW9fORN0nn2aS2VK0bDHCrnmm2lLwP98xVHC6ywdP0PJSNV_PXFHYlcImZ1X7txc44QOuCReVN1fb26No4eIlqBXiMaBVsi3PzUIpBEV5JADjsqUdykkLxdxX7StmIH-R5BeEcVqXIBrEnA5K5o21sDP0CfLg7m7h-Fa5L1AZKbgTJCIzBUskJNiWfWO5Bhm4",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 13,
        "title": "a-ha.io",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEYPRR3tPInkyvs7m8z15Va18JE4yzJ2VYu6H4CZK-VROUvGvWcVQGgTIXXkNgeqalI3_7Ud0nGOWi8GX1i--rwh6GElrQaneJBA0c7odr9dwyxZiIufMM1UVfTr9q5qHDtlaMOLc-MymqewqecVM_RKgeVsfB3Lj9A",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 14,
        "title": "jobkorea.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEI92_xCn1pZHJTODuht1KDsJpzmJVO7TMnXMln8_lLn-TNnXOE8wXNKlBCusMuUVBpOC4wb9qyawDsasdQCOrAe7L5YNgRK2kTmSotbQ6BfjTHnQlsZO1VfSzPriDqPgQrDn8YNN11Q2-5cWR4pcY47qd6yUfWND0qYJKxPsITpUCx",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 15,
        "title": "aitimes.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH1expjejtcRrJ46PCM6AICrfJ8fh67S9QkeOcaQakPHWazPB9w3Hj0FneOXLRdD7XAi4su0Iel4Nhd7zUatc8lVSQq2pvQwf4VrvT74IoROLYdd2NIcvUE3hhOGFAHheB35C3H7tyQuNnsl5mzT1lJplTT",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 16,
        "title": "hankyung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFq6LodD4Dg0a0c64ZTSwqxgz9lXZ0bCOAmuuqOYUmHPyOmRnW2O8q6Wz4uQb--USkTM8sG0nir4k2eAxcT0NrDsfaISih1AXb5xfJ7LsX0a_ah7Jp3w6TtFxqu8oT8hlJTM5kmWE6ED7o=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 17,
        "title": "youtube.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGSDqo-kRCc8GCudzR9AXWnN2nLIQPsTg3y8riHI8X1gVa7wVeERGcMuZ6l2O1tHyoaelL8pUREaTgjbtECs1C1pealmC8JxsszgxdY93px7yw7hGpvMROG-fdmaLQ_hDuZLR-VJcA=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 18,
        "title": "goodkyung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG4LJJmPivFXPI-ybxvKaHBqt4WhdOPC0TAcWmtXJR9Y1ubjVyyITXBPkpjuhPjhIT_uiatIMgDvvGBa7_fm8OGLHmcog2RBnphmRaGA12ppSq2imfwfySKIi3pEDALv8iyE50AS-H1vGjyMsgerQYgsxs0kDiQEg==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 19,
        "title": "issue-blog.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF-MQ0vGr8PLxtFHJbzEo_lW4jAs_ZSb27XnzdIgO5WmBUL9b_1R4o9rlWCNorD9uOXFg27r5qAbDU0UTkyYOyyUZCxeLJ697zIz0L84r1MmAWPJD13C4uRq1EBGJzQ3ZELghq9XfGjMCCYJwKgeg==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 20,
        "title": "pointe.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDbWNCwFDGIKfwAV23W632hcwEtT809azHn8LQywwfA5YJqzrqXj9JLDF8s4GdT0lb2but-fOL5kuJbSrqIvoVefufC-0w0rQmrvRiJ80peMMM2B84-1qIAiOlvgWE_8c4gz3j8tNit03gWYdlUzOxg-TYlFY=",
        "publisher": "vertexaisearch.cloud.google.com"
      }
    ],
    "reportMeta": {
      "kind": "COMPANY",
      "schemaVersion": 1,
      "asOf": "2026-09-08",
      "searchQueries": [
        "삼성전자 사업보고서",
        "삼성전자 주요 사업 부문",
        "삼성전자 주력 제품",
        "삼성전자 고객사",
        "삼성전자 경쟁사",
        "삼성전자 신사업 투자 2024 2025 2026",
        "삼성전자 미래 성장 동력",
        "삼성전자 M&A 2024 2025 2026",
        "삼성전자 조직 개편 2024 2025 2026",
        "삼성전자 HBM 투자",
        "삼성전자 파운드리 전략",
        "삼성전자 AI 전략",
        "삼성전자 실적 발표 2024 2025 2026",
        "삼성전자 매출 영업이익 추이",
        "삼성전자 IR 자료 2024 2025 2026",
        "삼성전자 공시 2024 2025 2026",
        "삼성전자 주가 시가총액 2026",
        "삼성전자 전략기획 직무",
        "삼성전자 경영진 발언 전략",
        "삼성전자 인재상",
        "삼성전자 지속가능경영보고서"
      ],
      "searchEntryPointHtml": "<style>\n.container {\n  align-items: center;\n  border-radius: 8px;\n  display: flex;\n  font-family: Google Sans, Roboto, sans-serif;\n  font-size: 14px;\n  line-height: 20px;\n  padding: 8px 12px;\n}\n.chip {\n  display: inline-block;\n  border: solid 1px;\n  border-radius: 16px;\n  min-width: 14px;\n  padding: 5px 16px;\n  text-align: center;\n  user-select: none;\n  margin: 0 8px;\n  -webkit-tap-highlight-color: transparent;\n}\n.carousel {\n  overflow: auto;\n  scrollbar-width: none;\n  white-space: nowrap;\n  margin-right: -12px;\n}\n.headline {\n  display: flex;\n  margin-right: 4px;\n}\n.gradient-container {\n  position: relative;\n}\n.gradient {\n  position: absolute;\n  transform: translate(3px, -9px);\n  height: 36px;\n  width: 9px;\n}\n@media (prefers-color-scheme: light) {\n  .container {\n    background-color: #fafafa;\n    box-shadow: 0 0 0 1px #0000000f;\n  }\n  .headline-label {\n    color: #1f1f1f;\n  }\n  .chip {\n    background-color: #ffffff;\n    border-color: #d2d2d2;\n    color: #5e5e5e;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #f2f2f2;\n  }\n  .chip:focus {\n    background-color: #f2f2f2;\n  }\n  .chip:active {\n    background-color: #d8d8d8;\n    border-color: #b6b6b6;\n  }\n  .logo-dark {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #fafafa 15%, #fafafa00 100%);\n  }\n}\n@media (prefers-color-scheme: dark) {\n  .container {\n    background-color: #1f1f1f;\n    box-shadow: 0 0 0 1px #ffffff26;\n  }\n  .headline-label {\n    color: #fff;\n  }\n  .chip {\n    background-color: #2c2c2c;\n    border-color: #3c4043;\n    color: #fff;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #353536;\n  }\n  .chip:focus {\n    background-color: #353536;\n  }\n  .chip:active {\n    background-color: #464849;\n    border-color: #53575b;\n  }\n  .logo-light {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #1f1f1f 15%, #1f1f1f00 100%);\n  }\n}\n</style>\n<div class=\"container\">\n  <div class=\"headline\">\n    <svg class=\"logo-light\" width=\"18\" height=\"18\" viewBox=\"9 9 35 35\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M42.8622 27.0064C42.8622 25.7839 42.7525 24.6084 42.5487 23.4799H26.3109V30.1568H35.5897C35.1821 32.3041 33.9596 34.1222 32.1258 35.3448V39.6864H37.7213C40.9814 36.677 42.8622 32.2571 42.8622 27.0064V27.0064Z\" fill=\"#4285F4\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 43.8555C30.9659 43.8555 34.8687 42.3195 37.7213 39.6863L32.1258 35.3447C30.5898 36.3792 28.6306 37.0061 26.3109 37.0061C21.8282 37.0061 18.0195 33.9811 16.6559 29.906H10.9194V34.3573C13.7563 39.9841 19.5712 43.8555 26.3109 43.8555V43.8555Z\" fill=\"#34A853\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M16.6559 29.8904C16.3111 28.8559 16.1074 27.7588 16.1074 26.6146C16.1074 25.4704 16.3111 24.3733 16.6559 23.3388V18.8875H10.9194C9.74388 21.2072 9.06992 23.8247 9.06992 26.6146C9.06992 29.4045 9.74388 32.022 10.9194 34.3417L15.3864 30.8621L16.6559 29.8904V29.8904Z\" fill=\"#FBBC05\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 16.2386C28.85 16.2386 31.107 17.1164 32.9095 18.8091L37.8466 13.8719C34.853 11.082 30.9659 9.3736 26.3109 9.3736C19.5712 9.3736 13.7563 13.245 10.9194 18.8875L16.6559 23.3388C18.0195 19.2636 21.8282 16.2386 26.3109 16.2386V16.2386Z\" fill=\"#EA4335\"/>\n    </svg>\n    <svg class=\"logo-dark\" width=\"18\" height=\"18\" viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\">\n      <circle cx=\"24\" cy=\"23\" fill=\"#FFF\" r=\"22\"/>\n      <path d=\"M33.76 34.26c2.75-2.56 4.49-6.37 4.49-11.26 0-.89-.08-1.84-.29-3H24.01v5.99h8.03c-.4 2.02-1.5 3.56-3.07 4.56v.75l3.91 2.97h.88z\" fill=\"#4285F4\"/>\n      <path d=\"M15.58 25.77A8.845 8.845 0 0 0 24 31.86c1.92 0 3.62-.46 4.97-1.31l4.79 3.71C31.14 36.7 27.65 38 24 38c-5.93 0-11.01-3.4-13.45-8.36l.17-1.01 4.06-2.85h.8z\" fill=\"#34A853\"/>\n      <path d=\"M15.59 20.21a8.864 8.864 0 0 0 0 5.58l-5.03 3.86c-.98-2-1.53-4.25-1.53-6.64 0-2.39.55-4.64 1.53-6.64l1-.22 3.81 2.98.22 1.08z\" fill=\"#FBBC05\"/>\n      <path d=\"M24 14.14c2.11 0 4.02.75 5.52 1.98l4.36-4.36C31.22 9.43 27.81 8 24 8c-5.93 0-11.01 3.4-13.45 8.36l5.03 3.85A8.86 8.86 0 0 1 24 14.14z\" fill=\"#EA4335\"/>\n    </svg>\n    <div class=\"gradient-container\"><div class=\"gradient\"></div></div>\n  </div>\n  <div class=\"carousel\">\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEvGGi2QtaaV2FoyKXOhFp5aBpWockj4xnq0To6NCqN25o-Zlgn7mNRpX6W7z-PiF7H2eB_NzG-bCnaSrRWEAtJ48qF92ljJa6bU4DBBksnMV2aHMojH-MAxv-iisnBTwHwtkOm8mTori5dK5nIQ0IfvVEcuC0FgzC5kqrRCmomzg6Zl_T3turrXzNNHv6R8aEqWBLnELGyTSO_tn5MGfUUeAXWE-ILzEtmxSmSQKi4Z3pxIOPmlpviMVt0d5U=\">삼성전자 M&amp;A 2024 2025 2026</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFrgCREG-rX43n01JWjelRJiXaEfuaFdxgy6g1pxS09VwE_xZ5Sa2ObIaUF_8ChnYyH9RyL6r0zXnoGhreTMGL-z0KzPTiXC5fKoganYpIzgBghyAH6kHRBdMmRBeCuL9490d606T8wG4SHVsxUfgwnL9Bxc9ZrLuLkbfOnd6DgwDbxqlFXTIWL3a-w1xx-u41vZKhZ1mguL70aq17cTNJo_rvmCOm8gruws-4VnEw5txaj307VP7j6gVyAawS-E78AF4qjsFMXEEmnuLMtZc8UDUb43BpogTMYySmVt3MxrpbHVP_ArguHpoA=\">삼성전자 경영진 발언 전략</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHNpmD9uSmMuCcGR1qtKEv8SEqRobcLrsg4reeVwImnRPs_PvhvyaGhrBbatLgyG4DhEox3OBibzmvn_hz8cHmPEn5mMDWhQjHZzTSG5z7myqIfpg7u8xt8gyk4ta0DdqCPz32eNV4nYYKPV5PyZkk0ZQ3BfI3MMw5mxrczHxuvze5Q9Ty4f_btgHEdfPpkN27bk4cei3GVtq_egXqs4L_hWQfUbf4nAdnFzmfOi96cjA70dmMM4t78Nh7BH8gkdLLAzPzf\">삼성전자 인재상</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEhF0ZQANFDmdYTEjAJQbp8bHKmbicWh6NT0CovY6r_zccN4uMhEMU3XsL0wMO5KO-ougncPZEAvX38fy1GtEciAoZ0Ei896QlV8T_nJIlwdYsQSfg1DnvtHbfnhitGGPNkf9YA9IyVtqnTqMQ2SOfjcAYxHL_bJyRfAgI7V2dXitUXfu0WBwnSeVyJdorEO_rNlZEepgNS1dFyV65e9JCp9dgdWjzcwN4Ok4h_TyHzI_fritmDOr5diKmxZ2bluz7lOMmTuvQzTj4W0zlmSLXZtgTycH_kG9UwEaRlHUn7S2fk_pOduf8hhTscKD9nEZPl5ejG6hmxNJo8\">삼성전자 지속가능경영보고서</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHY14kw1fJewkGikvMfRXK3izpCEiyKk_WRoZEzaqPTuuFxV_prTFdez4SSPM7chohei7RlLquGV5fWyE7aX0aQX_oKlakECil454mEPuflE-kjwUFnKWOkGa3zR2ws8kigUdzcAfUBfTSTKPbmOdm9XdHcUJk_PFi9fvgmDkvsDpEqqT4u8CbqYn_R432SC84QxnkL_kQoVe15BVYphD0O_YSFpSjUDM16Ehf4FCqUYfGyqvtiitC5XkIqv3-NRykMn7vdQQDMZHvF-jzkNHPiYk1C2ImQZUUg1GZJ5wi9tJd0OcDrKQ==\">삼성전자 신사업 투자 2024 2025 2026</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGyR2QMgZpQ6kzkIQ5ulo23lUpoouZxttzJGLD_YQmzPwxoyOXE3faJC43Fd0UjX23PG-NCeeOAfslQnJc_gmjxRzHEAAcQkcTiSzY5aPXtbJU7mYFu5Hx7iZqSQpoHSoHpZPgWuzAWTWLMWf-77XjMP5DGRGeRdtDGidQwyDE5638qlJ0OkOX510JsrFF7KgICFzFXInK4BhLnWN6wxU3l1tBv14i8snkeTpXvmhnhNUmgtKdIWXHNWr6flpBQcWlosKQsZQMee5IH0xEuBGHEPt2IxCq4FManDs02UQ==\">삼성전자 조직 개편 2024 2025 2026</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzrkO2Nqudp6EgGvUXa8DeImYfi61590ZrZKF1L-8BcsUPjyr_j7LWh3WtxMCM9RFITzI6Nt1mBoJx8SCoP05EL5TquhBo67yBp1nqlv02j7t4sU4VESZrKHMUUJ-J71gO68fQzMfNdd5kZCP2IWdynvxvAUUjP5Aawq-6Yq7_ykJQT-VE-WdEBdK23zmSh9xTBTCDCAWoaWadSzBML_SIVCH29glkT0dpp0DXSkeiIkIMJMPDgRXbRdWKLvZ8zJDbMRvcz7DL9uZU5tp3R4F5PG4HcC7_S6cG3VZDNQ==\">삼성전자 실적 발표 2024 2025 2026</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE7ZwFzBeOD5HQduXPBQMSjcA-j_vagdJhSnHqwQJG7t6l5M_inATx3qo38bKN8qOr-PD7eQFVIU0acX7oFXusPvzyQxeGNP-43mAFvv65JmLKml61czw5LlZjD67fa5e5u3k-0Yn9uJkiKijPxSb1KuJYG8be47eFGCh9YON5khs6Jfd0DNB6-G0-icdnslVTBEX5HQTYBknCr9QbrbXTWf1Bz6sKNzVHn9bPkdTkyQNFBLpOOf_YQYrjloIWAcJaApjxw4_Cigb_M-pDt-8T3O5F4PFEdO1vDiozz-UoGmf9VGlR9\">삼성전자 주가 시가총액 2026</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGBgLG8V_7TZFMmVquRvJy1zo8fJLDgE32VijJSO8wqSFBbQufoDfW9QZ95HzTBTuRETBNg1hWHL7b8hCpIoFVkF_lDhsXL3dzU1JJTDb9ydST7wzwnI5RyLL3c1fzanCdwwqp7qi-awJ3vd71AVfE3ex3XJDllSiLvzgqsfBn7x_HgfRmWL7AStuuIWHI2JUDoRxzfAHXoqtHRvngVE33048kqlBrHY2ao_h3B6aif3Vm90uBFNkFs0Ky_unbrF2T4CfRO\">삼성전자 고객사</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFaUCvlikw_77JdOff3-1MGjOLbogOfOj-Svl8f5TbZ6ANhFwcpLgvxiZgZxXXruy_9G_MH4MaErvvuWJ7vpSi9BrSkQnttMXEan4ayEwNEUznaTD17Z-0G6Dwaq3RbAPMV5k27o-lSDLNcLY648U-q8vIGFGF3Os0PITJiKa7fXRF-KpsuKAF1NLT-bYMuzTiWTaPu9orVXZOTJ7yOBtoLMcrfHNaFRv0hcdp9uBFryfRSXCFoz2wkoVYNZzzOC0MG23Rcz5JyisDUmuO61Q==\">삼성전자 주력 제품</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGm-5q743tzk1c_6Phr7FTkufvCeHFrF-mvSMkNy657OnmKHUKnckm6hPpnfzyTJxDpE5pn8lHlz-IIeIkAG6hCJFS00L2m977ym9kOOVK3borVdWVXpS6aoJciwN7GcZUQTgqpfXPhKsQ0eIoZpit80IUhqdJ43BWgxrd2UPT8j5lVTL4lXrfLNa5KP0cx1nWRS8EPKhQ4tFaoIY2LkY4Szjyg7Gk-KY8MDt41TfFn29llJn7-kKN1oEeAWOr80O67H9ebxdSZ7o-lGJXqMn78qHY356C_\">삼성전자 사업보고서</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHxfnUC337-wH29Cq0bIOX3E9Je0DvKoFHuhXGpwPy_HJ8ZKgSUbJ0ho8j27MH0oi-33Fpos7JpGivT2nwB02LNNxhi2JnCjElopDp7Ib4rxAcpftb25qVTjRXkeuu1fFHxVUnG-Rb-HzuHtCUPdn4O-4cjENGGqPdc-WVmOHXbHNiV3XKE1xggADiZbUqTdbBBVZMiu-tNu2Em40abxCQc_Hj0rTq_uLndn4v83CNbq9CHXIV-diESWJBTN61DXJduqDBDk7PwXYxeV-ou2TcNhZ0kLmQZTelzquHxo_CpJVU=\">삼성전자 주요 사업 부문</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGVmOzYGvMgtRCrUwj0ilWehOHfaJaJDuiPNgiZ-LcrMviJMm62UCknJeBCy7LnXFMIted-n1-ZEN1D70Wv0WWiv6kisv6fq6hPOarRtXlVaJlaQAJ2hej2cDggrjYvS99ShyH1sBOZR905FN_08XW51H0YXNMpKhEnIVGxiMBC-_5SvUeFk1cp5AQymk7z0dFrFT2Bdr7YdLFvI__e0fg3RFYk6oy6UH0gnN-IkoxAPbZtd702EQN9C0wgH0Y6NzPOa0E6y3GDVXHyj-jE8FDjRN2AmiUAru5rGJPxgjhKM84=\">삼성전자 미래 성장 동력</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFN-tGXJsCTcQH-59VB-MBAA1Py5co3GZxk5toHw3sno_9BWk-V4ozq6q9_BCp9e19XB13KSEEb4SCPZdLXx1nBorHXezmbNUUyPGih8UDdIKBDYTpk4ASQqKUtYoIsVV6pwj0WzA6JD1oq3m0u6XuPkiqirLI-d9oEBx4Duw4PrSdzwKlVqNTzfk3hWOPa_FsDhujEMI9ghaCrSA2SDVd8Fl_ag1C2R7w-pv6Pm-jUITZDCTnF_Y-NW39cVnG6SWyZ3HYQ\">삼성전자 경쟁사</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEpM27JvIUj0YWZFpvgKcSK-ENwp0RkGuPyrpx7YxY1fWgIUpRJlp0z7H4pdlYloYVGGmA7ui676BER5_XDNRFq-H2mwjdONG_vtLsXf2BRp_LqyCSsjf8tpgKzTv52Ll42SX6BqeVt54PgMOaGLno-mrlbloCc8JlSZjp2fw3pICAwxi7iXi6zObVVeaeD4n2B724MVHM_Ev1Bb6isI6uLy0Hko0JL-EsHNe_LXus0952JazIO3BtwaXt4frOIwQ==\">삼성전자 HBM 투자</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHgRnp2fOcYWviWsV4Ynf4hFPJspwD7tcyTQy1p9__HehB-hXxEZ5O8kEiQ3cy4juM_20FNs723vWaxhRYS2TOahw-apvIuUCWBmbe4fgNzhyyXEcge8uEYv6sKo8SMq4xOabBDaA9eok45wrJy41uxwjNaWIhLOayqx6QG3Ea69-eW2JkE57wFgDWavjTJNVRMudf4SNLge7z_cjC4NVNthiBnDQ_f41twsJCtc92HmMY_uCjYIZHMVDDVf4fushZgdcy4kmw0E1Y7P8bVUdWSCDkRyGfZXHOPPE05qM8lPQ==\">삼성전자 파운드리 전략</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEpY4Yko-ctnPJlTQAlf0-JxUAeUjx1sr63VdZYiuVy7zhdQ0jAcOECnHbEQeofIgkaldvFLo5_pwzMPTELcYDM9o2XERrRXHn2io9_29Hq0QlrUQAH--H4vX_wsynHEOkal6wIU4b6S-M6k8jkjRv6GRXfl741z7Gk6QBFGNeAo_ntRGScijfRxDMvF6UP3ByeMssR4LbvEorSqiNxFSgA9Vq2AUsGTqLlyOz2u1EkRRd8-HGYR0BzawF-5imEi1kxL1SY1Xuiiym910-X\">삼성전자 IR 자료 2024 2025 2026</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8KhmzoqaQiZCZ7cLUdJqIY70kMqCXnbS1XuskftDnkPBIrsSt-jNZ4FnPnd0FxD8EWYwkFH4x6yVxostgm2EOxY4biZVV37VvFWGwq8pt8Dssp0yyH40z5Vcl2qrBpw4X19QdYXdFly09uQPuHWUjqYJRxGnM07CPPQipB3HChPvbDq7FvOsdPyXfKBHJl0ZsMyAEG8Y1uvmU0X1DiEeBz6g8ACI6aClLA001_cfs6ETV2YEcDD5_s2aaplei\">삼성전자 AI 전략</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHaWgrucgbmzzOSiJhn_1dnEyn45bjgUile6u_HBcDzqiJpp9pjykd1L5hW2t0A6u1d35pP07Fgdu22gJm_zxEhmW2MVGm-k6GN69QGjMJYtTwj44sxV87xFGzTkXMZdAt6kCKKtFztNcam6EQzAFGLy9V70MK1B0maiNEnpKf3IcYo3OflI-mVWK7MNKSSFhDW7R0p5owq__fY0UdSljohwYlByXjO6zaSGtkzuqST4xpZM4ypaQnvK9X-VyhAIqhSvZD1oLn1n-bV\">삼성전자 공시 2024 2025 2026</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEdzB9gXTxaYi5kpZR-rTnd86gS7U9dKCmXntAg9xaUElSj4IPYTEq_v91fm6t1wg_okkLq3vo1xCtteMDKcYTvIhUX4lutAsLGHKHsdHjlqjEgDTbHCpzi8XKznrsAGVo4lLbDTpb-zG4rE5c5reqcnYpnC1OUcNoUmebDs_eNBb66gOTYu2mCfasbkg3y6b6dGw5mTnNeCOO_cWtFvSL1xbXvxNgg7E_CErZkbP7qen9vE5ruWdeOl7yzbWKVcvNTm8ALKSifhb95YlCER1wafBz5v-3SOZZ1zG4mLakCKJkI3OM28iG2VljVxoTBy5Khc-o=\">삼성전자 매출 영업이익 추이</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGg-KrK01N6XojD_ZSm7gUisj12QIaN0AE5gGCu4lyWc-rEBz5Cy0W3JT3a1QZ4RIQNvKX6zIPrDX9pPr4yxdpSb1I_aDTboysoRb5A5FTZMOtR9NmytcorB8JWd3Y25koBQymzB7LUAYn5QBxCYDsUsyFiQd18y6NGBhBaNyQK7J_EelnWKYk1TnRxLAcqxFEZYctmvZVP-X1OSSdEFsgWhUIIuzrB8GVr9D3YeU1jk2wmrc5KDZ-o36nTyTvXF8SP84o9r8cXDwRcd14wZQsUjPN8QjaYQGMYYhwUhiwA5w==\">삼성전자 전략기획 직무</a>\n  </div>\n</div>\n",
      "linkedResumeAnalysisId": null,
      "repaired": false
    }
  },
};
