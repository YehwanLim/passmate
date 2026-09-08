import type { CompanyReportData } from "@/types/companyReport";
import { COMPANY_REPORT_SAMPLE_COMPANY, COMPANY_REPORT_SAMPLE_JOB_ROLE } from "./companyReportSampleMeta";

/**
 * 공개 샘플 리포트(/company-report?sample=1, 랜딩 소개 섹션).
 * scripts/manual/company-analysis-probe.mjs --out 으로 생성한 실제 리포트를 사용자가 검수해 굳힌 것이다.
 * 갱신: node --env-file=.env scripts/manual/company-analysis-probe.mjs "<회사>" "<직무>" --out sample.json
 *       → result 에서 analysisMeta 를 뺀 나머지를 report 에 붙여 넣는다(searchEntryPointHtml 포함 — 검색 그라운딩 약관).
 *       서버가 반환 전에 거는 tidyCompanyReport 가 프로브 결과에도 이미 적용돼 있다(현재 샘플은 2단 병렬 파이프라인, 2026-09-08).
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
      "oneLiner": "반도체, 스마트폰, 가전, 디스플레이, 전장을 아우르는 글로벌 전자 기업",
      "keywords": [
        "반도체",
        "스마트폰",
        "가전",
        "디스플레이",
        "전장",
        "AI"
      ],
      "asOf": "2026-09-08",
      "positionInIndustry": "삼성전자는 반도체, 스마트폰, TV, 가전 등 다양한 분야에서 글로벌 시장을 선도하고 있으며, 특히 메모리 반도체와 중소형 OLED 패널 분야에서 독보적인 경쟁력을 유지하고 있습니다. 파운드리와 모바일 사업에서는 TSMC, Apple 등과 치열하게 경쟁하고 있습니다."
    },
    "businessMap": {
      "summary": "삼성전자는 크게 완제품을 담당하는 DX 부문과 부품 사업을 담당하는 DS 부문으로 나뉘어 수익을 창출합니다. 여기에 디스플레이 패널 사업의 SDC, 전장 및 오디오 사업의 Harman이 더해져 사업 포트폴리오를 구성하고 있습니다. 특히 DS 부문이 전체 이익의 대부분을 차지하며 회사 성장을 견인하고 있습니다.",
      "segments": [
        {
          "name": "DX (Device eXperience) 부문",
          "whatItDoes": "TV, 모니터, 생활가전, 스마트폰, 네트워크 시스템, PC 등 최종 소비자에게 판매되는 완제품을 개발하고 생산합니다.",
          "weight": "2025년 매출액의 절반 이상을 차지합니다.",
          "phase": "성숙",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "DS (Device Solutions) 부문",
          "whatItDoes": "DRAM, NAND Flash 같은 메모리 반도체와 모바일 AP, 카메라 센서칩, 파운드리 등 시스템 반도체를 설계하고 생산합니다.",
          "weight": "2025년 매출액의 약 3분의 1을 차지하지만, 전체 이익의 80% 이상을 기여할 것으로 전망됩니다.",
          "phase": "성장",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "SDC (Samsung Display Corporation)",
          "whatItDoes": "주로 OLED 중심의 디스플레이 패널을 개발하고 생산하여 스마트폰, TV 등 다양한 전자기기 제조사에 공급합니다.",
          "weight": "2025년 매출액의 약 8%를 차지합니다.",
          "phase": "성장",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "Harman 부문",
          "whatItDoes": "전장부품과 오디오 시스템을 개발하고 공급하며, 차량용 인포테인먼트 및 커넥티드 솔루션을 제공합니다.",
          "weight": "2025년 매출액의 약 4%를 차지합니다.",
          "phase": "성장",
          "sourceIds": [
            1
          ]
        }
      ],
      "customersAndCompetitors": "주요 매출처로는 Apple, Best Buy, Deutsche Telekom, Qualcomm, Verizon 등이 있으며, DS 부문에서는 TSMC, SK하이닉스, Micron 등과, MX 부문에서는 Apple 및 중국 업체들과 경쟁하고 있습니다."
    },
    "focusBusinesses": {
      "statedDirection": "삼성전자는 AI 기능을 스마트폰과 가전 전반에 확대 적용하여 프리미엄 제품의 부가가치를 높이는 전략을 추진하고 있습니다. 또한 로봇을 미래 성장동력의 핵심 축으로 육성하고, AI 반도체 등 유망 산업 분야에 대한 투자를 적극적으로 진행하겠다는 의지를 보였습니다.",
      "items": [
        {
          "name": "AI 기능 확대 및 AI폰 출시",
          "whatChanged": "2024년 5월 세계 최초 'AI폰' 갤럭시 S24 시리즈를 출시하고, 비스포크 AI TV, 냉장고, 청소기 등 AI 가전 신제품을 동시다발적으로 선보였습니다.",
          "evidence": "갤럭시 S24 시리즈 및 비스포크 AI 가전 출시, AI 기능을 스마트폰과 가전 전반에 확대 적용하는 전략 추진이 확인됩니다.",
          "whyNow": "AI 기술이 스마트 기기와 가전의 사용자 경험을 혁신하는 핵심 동력으로 부상하면서, 삼성전자는 AI를 통해 제품 차별화와 프리미엄 시장 리더십을 강화하려 합니다.",
          "relevanceToRole": "직접. 전사적인 AI 전략 수립 및 사업 부문별 적용 방안을 기획하는 데 핵심적인 사업입니다.",
          "sourceIds": [
            2
          ]
        },
        {
          "name": "고대역폭 메모리(HBM) 및 AI 서버용 고부가 제품 확대",
          "whatChanged": "HBM 생산에 라인을 집중하고 AI 서버 수요 증가에 맞춰 서버용 고부가 제품 비중을 높이고 있습니다. 이는 일반 D램 공급 감소와 가격 상승으로 이어지는 선순환을 만들고 있습니다.",
          "evidence": "HBM 생산 라인 집중 및 AI 서버용 고부가 제품 비중 확대 전략이 확인됩니다.",
          "whyNow": "생성형 AI 시장의 폭발적인 성장으로 고성능 AI 반도체 수요가 급증하면서, HBM은 메모리 시장의 핵심 성장 동력으로 자리 잡았습니다.",
          "relevanceToRole": "직접. 반도체 사업의 중장기 전략과 투자 계획을 수립하는 데 매우 중요한 사업 영역입니다.",
          "sourceIds": [
            2
          ]
        },
        {
          "name": "파운드리 사업 경쟁력 강화",
          "whatChanged": "테슬라와 23조원 규모의 파운드리 대형 수주 계약을 체결하여 성장 기반을 강화했으며, 2나노 1세대 양산 본격화와 HBM4 베이스다이 생산 확대로 2026년 1분기 가동률이 80%대까지 상승했습니다.",
          "evidence": "테슬라 대형 수주 계약, 2나노 1세대 양산, HBM4 베이스다이 생산 확대, 가동률 상승이 확인됩니다.",
          "whyNow": "고성능 반도체 수요 증가와 함께 파운드리 기술 경쟁이 심화되면서, 첨단 공정 기술력과 안정적인 고객 확보가 시장 지배력 확대를 위한 필수 요소가 되었습니다.",
          "relevanceToRole": "직접. 파운드리 사업의 기술 로드맵, 고객 전략, 생산 효율성 개선 방안을 기획하는 데 핵심적인 사업입니다.",
          "sourceIds": [
            2
          ]
        },
        {
          "name": "로봇 사업 시작 및 육성",
          "whatChanged": "삼성전자는 로봇을 미래 성장동력의 핵심 축으로 육성하기 위해 대표이사 직속 'RX(Robotics eXperience)사업추진실'을 신설했습니다.",
          "evidence": "유진투자증권 리포트에서 로봇 사업 시작 언급, RX사업추진실 신설이 확인됩니다.",
          "whyNow": "AI 기술 발전과 고령화 사회 진입 등으로 로봇의 활용 범위가 산업 현장에서 일상생활로 확장되면서, 로봇은 미래 신성장 동력으로 주목받고 있습니다.",
          "relevanceToRole": "직접. 신사업 발굴 및 육성 전략 수립, 시장 분석, 투자 계획 수립 등 전략기획 직무의 핵심 역할과 직결됩니다.",
          "sourceIds": [
            2,
            4
          ]
        }
      ],
      "translatedTalentKeywords": []
    },
    "financialSnapshot": {
      "listed": true,
      "market": "유가증권시장 · 삼성전자",
      "revenueTrend": "삼성전자의 연결 기준 매출액은 2023년 258조 9,000억 원에서 2024년 300조 8,709억 원, 2025년 333조 6,059억 원으로 꾸준히 성장하는 추세입니다. 이는 반도체 업황 회복과 AI 관련 수요 증가에 힘입은 것으로 보입니다.",
      "profitTrend": "영업이익은 2023년 6조 6,000억 원에서 2024년 32조 7,259억 원, 2025년 43조 6,000억 원으로 큰 폭의 성장세를 보였습니다. 특히 DS 부문의 이익 기여도가 크게 증가하며 전체 수익성 개선을 주도하고 있습니다.",
      "keyFigures": [
        {
          "label": "매출액",
          "value": "333조 6,059억 원",
          "period": "2025년 연간",
          "sourceIds": [
            3
          ]
        },
        {
          "label": "영업이익",
          "value": "43조 6,000억 원",
          "period": "2025년 연간",
          "sourceIds": [
            3
          ]
        },
        {
          "label": "당기순이익",
          "value": "45조 2,000억 원",
          "period": "2025년 연간",
          "sourceIds": [
            3
          ]
        }
      ],
      "marketView": "삼성전자는 한국거래소 유가증권시장에 상장되어 있으며, 기준일 무렵의 주가 및 시가총액 흐름은 확인하지 못했습니다. KB증권은 2026년 9월 4일 삼성전자에 대해 연내 추가 주주환원 기대를 언급하는 리포트를 발행했습니다.",
      "recentDisclosures": [
        {
          "title": "임원ㆍ주요주주특정증권등소유상황보고서",
          "when": "2026-08",
          "sourceIds": [
            3
          ]
        },
        {
          "title": "대규모기업집단현황공시(분기별공시)",
          "when": "2026-08",
          "sourceIds": [
            3
          ]
        },
        {
          "title": "2026년 반기보고서 제출",
          "when": "2026-08",
          "sourceIds": [
            3
          ]
        },
        {
          "title": "2026년 2분기 경영실적 발표",
          "when": "2026-07",
          "sourceIds": [
            3
          ]
        }
      ],
      "fundingNote": "",
      "forApplicant": "최근 실적 개선은 반도체 업황 회복과 AI 관련 신사업 투자 성과가 가시화되고 있음을 보여줍니다. **이는 회사가 새로운 성장 동력에 적극적으로 투자할 여력이 충분하며, 전략기획 직무로서 새로운 사업 기회를 발굴하고 실행할 기회가 많다는 의미입니다.**"
    },
    "currentIssues": [
      {
        "title": "AI 대전환(AX) 논의 및 M&A 추진",
        "when": "2026-06",
        "fact": "삼성전자는 상반기 글로벌전략회의를 열고 AI 대전환(AX)을 핵심 의제로 논의했습니다. 이 회의에서 로봇 사업의 실행 속도를 가속화하고 신규 M&A 및 외부 협력 확대를 추진할 것으로 관측되었습니다.",
        "whyItMatters": "AI 기술이 전 산업 분야에 미치는 영향이 커지면서, **회사는 AI를 중심으로 사업 구조를 재편하고 미래 성장 동력을 확보하기 위한 전략적 방향을 모색하고 있습니다.** M&A는 이러한 변화를 가속화할 수 있는 중요한 수단입니다.",
        "forApplicant": "전략기획 직무 지원자라면 회사의 AI 전략 방향과 M&A를 통한 신사업 확장 가능성에 대한 이해를 보여주는 것이 중요합니다.",
        "sourceIds": [
          5
        ]
      },
      {
        "title": "AI 자율공장 전환 추진",
        "when": "2026-03",
        "fact": "삼성전자는 MWC 2026에서 2030년까지 'AI 자율공장' 전환을 추진하겠다고 발표했습니다. 생산, 설비, 수리, 물류 전반을 지능화하고 휴머노이드형 제조 로봇 도입을 단계적으로 추진할 계획입니다.",
        "whyItMatters": "이는 제조 경쟁력을 극대화하고 생산 효율성을 높여 미래 산업 환경에 선제적으로 대응하기 위한 회사의 장기적인 비전입니다. **AI와 로봇 기술을 활용한 생산 혁신은 비용 절감과 품질 향상에 크게 기여할 것입니다.**",
        "forApplicant": "이 계획은 회사의 제조 및 운영 전략에 대한 깊은 이해를 요구하며, 전략기획 직무 지원자는 AI 기반 생산 혁신이 사업 성과에 미칠 영향에 대해 고민해볼 수 있습니다.",
        "sourceIds": [
          5
        ]
      },
      {
        "title": "총 2655조 원 규모 국내 투자 계획 발표",
        "when": "2026-06",
        "fact": "삼성은 AI 시대 기술 패러다임 변화에 대응하기 위해 총 2655조 원 규모의 국내 투자 계획을 발표했습니다. 이 중 AI 반도체, 로봇, 배터리, IT 부품·소재를 중심으로 호남, 충청, 영남에 625조 원을 투자할 방침입니다.",
        "whyItMatters": "이 대규모 투자는 미래 핵심 기술 분야에서의 리더십을 강화하고, 국내 산업 생태계 발전에 기여하려는 회사의 의지를 보여줍니다. **특히 AI 반도체와 로봇에 대한 집중 투자는 회사의 미래 성장 동력을 명확히 제시합니다.**",
        "forApplicant": "전략기획 직무는 이러한 대규모 투자 계획의 수립과 실행에 직간접적으로 관여할 수 있습니다. 투자 대상 산업의 성장성 분석 및 투자 효과 극대화 방안에 대한 고민이 필요합니다.",
        "sourceIds": [
          5
        ]
      }
    ],
    "roleInContext": {
      "whereItSits": "전략기획 직무는 DS부문 내 '부문 기획팀'의 '전략그룹'과 '투자그룹'에서 중장기 전략 및 신사업 전략 수립, 투자 전략 수립 및 실행 관리 업무를 담당할 가능성이 높습니다. 또한 DX부문의 '기획팀'이나 '경영혁신센터'에서도 전략 기획 및 수립, 운영 업무를 수행할 수 있습니다. 특정 단일 조직명은 확인되지 않아 사업부문별 기획 조직에 소속될 것으로 추론됩니다.",
      "problemsItSolves": [
        "각 사업부문의 중장기 성장 전략 및 신사업 기회 발굴을 위한 시장 및 경쟁사 동향 분석 보고",
        "AI, 로봇 등 미래 기술 트렌드 분석을 통한 신규 사업 모델 및 투자 대상 검토 자료 작성",
        "사업부문별 성과 지표 분석 및 개선 방안 도출을 위한 데이터 기반 리서치 수행",
        "경영진 의사결정을 위한 전략 보고서 및 회의 자료 준비 지원"
      ],
      "whyHiringNow": "삼성전자는 AI와 로봇 등 미래 신기술 분야에 대한 대규모 투자를 단행하며 사업 포트폴리오를 재편하고 있습니다. 이러한 변화의 시기에 **전략기획 직무는 회사의 지속 가능한 성장을 위한 새로운 사업 기회를 발굴하고, 효과적인 투자 전략을 수립하여 실행하는 데 핵심적인 역할을 수행할 것으로 예상됩니다.**",
      "recentNewsForRole": [
        {
          "title": "대표이사 직속 RX사업추진실 신설",
          "when": "2026-07",
          "fact": "삼성전자는 로봇을 미래 성장동력의 핵심 축으로 육성하기 위해 대표이사 직속 'RX(Robotics eXperience)사업추진실'을 신설했습니다.",
          "whyForRole": "이 신설 조직은 중장기 로봇 전략 수립, 핵심기술 개발, 사업화까지 아우르는 통합 추진 체계를 구축합니다. 전략기획 직무는 신사업 발굴 및 육성 관점에서 로봇 사업의 시장 분석, 기술 로드맵, 투자 전략 수립에 직접적으로 기여할 수 있습니다.",
          "sourceIds": [
            4
          ]
        },
        {
          "title": "이동건 부사장, RX사업추진실 Robotics전략팀장 선임",
          "when": "2026-07",
          "fact": "현대자동차그룹에서 로봇 전략을 주도했던 이동건 삼성전자 기획팀 부사장이 RX사업추진실의 Robotics전략팀장으로 선임되어 중장기 로봇 사업 로드맵을 담당하게 됐습니다.",
          "whyForRole": "외부 전문가 영입을 통해 신사업 추진에 속도를 내는 만큼, 전략기획 직무는 로봇 사업의 구체적인 로드맵과 실행 계획을 수립하는 과정에서 시장 조사, 데이터 분석, 파트너십 검토 등 실무적인 기여를 할 수 있습니다.",
          "sourceIds": [
            4
          ]
        },
        {
          "title": "윤장현 사장, DX부문 CTO 겸 삼성리서치장 승진",
          "when": "2025-11",
          "fact": "윤장현 삼성벤처투자 대표이사 부사장이 DX부문 CTO 사장 겸 삼성리서치(Samsung Research)장으로 승진하여 AI, 로봇, 바이오 등 신기술 투자 경험을 바탕으로 DX 기술 전략 전반을 총괄하게 됐습니다.",
          "whyForRole": "DX 부문의 기술 전략을 총괄하는 인사의 변화는 해당 부문의 미래 기술 방향성에 큰 영향을 미칩니다. 전략기획 직무는 DX 부문의 신기술 투자 방향과 연계하여 사업 전략을 수립하고, 기술 트렌드 분석을 통해 새로운 사업 기회를 발굴하는 데 중요한 역할을 할 수 있습니다.",
          "sourceIds": [
            4
          ]
        }
      ],
      "postingReading": ""
    },
    "opportunitiesAndRisks": {
      "opportunities": [
        {
          "headline": "AI 시대 반도체 리더십 강화",
          "text": "생성형 AI 시장의 폭발적인 성장과 함께 고성능 메모리 및 시스템 반도체 수요가 급증하고 있습니다. **삼성전자는 HBM과 파운드리 기술력을 바탕으로 AI 반도체 시장에서의 독보적인 리더십을 더욱 강화할 기회를 가지고 있습니다.**",
          "sourceIds": []
        },
        {
          "headline": "AI 기반 제품 및 서비스 확장",
          "text": "AI 기술을 스마트폰, 가전, TV 등 완제품에 전방위적으로 적용하며 사용자 경험을 혁신하고 있습니다. **이를 통해 프리미엄 제품 시장에서의 경쟁 우위를 확보하고, 새로운 AI 기반 서비스 모델을 창출하여 사업 영역을 확장할 수 있습니다.**",
          "sourceIds": []
        },
        {
          "headline": "미래 신사업(로봇) 성장 동력 확보",
          "text": "대표이사 직속의 RX사업추진실 신설을 통해 로봇 사업을 미래 핵심 성장 동력으로 육성하려는 강력한 의지를 보이고 있습니다. **초기 시장 선점을 통해 로봇 분야에서 새로운 사업 기회를 창출하고 장기적인 성장 기반을 마련할 수 있습니다.**",
          "sourceIds": []
        }
      ],
      "risks": [
        {
          "headline": "글로벌 경기 변동성 심화",
          "text": "반도체, 스마트폰 등 주력 사업은 글로벌 경기 변동에 민감하게 반응합니다. **예상치 못한 경기 침체나 수요 둔화는 실적에 직접적인 영향을 미칠 수 있으며, 이는 신사업 투자 계획에도 영향을 줄 수 있습니다.**",
          "sourceIds": []
        },
        {
          "headline": "핵심 사업 경쟁 심화",
          "text": "메모리 반도체 시장에서는 SK하이닉스, Micron 등과의 기술 경쟁이 치열하며, 파운드리 시장에서는 TSMC와의 격차를 줄여야 합니다. 스마트폰 시장에서도 Apple 및 중국 업체들의 추격이 거셉니다. **주력 사업에서의 경쟁 심화는 수익성 악화로 이어질 수 있습니다.**",
          "sourceIds": []
        },
        {
          "headline": "신사업 투자 성과 불확실성",
          "text": "AI, 로봇 등 미래 신사업에 대한 대규모 투자가 진행되고 있지만, 초기 시장 형성 단계인 만큼 투자 대비 성과를 예측하기 어렵습니다. **신사업의 성공적인 안착과 수익 창출까지는 상당한 시간과 자원이 소요될 수 있으며, 이는 단기적인 재무 부담으로 작용할 수 있습니다.**",
          "sourceIds": []
        }
      ]
    },
    "businessCandidates": [
      {
        "name": "로봇 사업의 중장기 전략 수립",
        "whyForThisRole": "삼성전자가 대표이사 직속으로 RX사업추진실을 신설하며 로봇을 미래 핵심 성장 동력으로 삼은 만큼, 전략기획 직무는 이 신사업의 방향성을 설정하고 구체적인 실행 계획을 수립하는 데 핵심적인 역할을 할 수 있습니다.",
        "angle": "로봇 기술 트렌드 분석을 넘어, 삼성전자의 기존 사업 역량(AI, 반도체, 가전)과 로봇 사업의 시너지를 극대화할 수 있는 사업 모델을 제안하는 각도",
        "experienceToPrepare": "신기술 시장 분석 프로젝트, 새로운 사업 아이템 발굴 공모전 참여, 스타트업 인턴십 경험에서 시장 조사 및 사업 기획서를 작성한 경험",
        "seedSentence": "삼성전자의 로봇 사업이 가전, 반도체 등 기존 사업과 어떤 시너지를 낼 수 있을지 구체적인 사업 모델을 제시하는 각도"
      },
      {
        "name": "2나노 파운드리 공정 기반 신규 고객사 발굴 전략",
        "whyForThisRole": "파운드리 사업은 삼성전자의 DS 부문 핵심 성장 동력이며, 2나노 공정 양산 본격화는 기술 리더십을 확보하는 중요한 전환점입니다. 전략기획 직무는 이 첨단 기술력을 바탕으로 신규 고객사를 유치하고 시장 점유율을 확대하는 전략을 수립하는 데 기여할 수 있습니다.",
        "angle": "글로벌 팹리스 기업들의 차세대 반도체 수요를 분석하고, 삼성전자의 2나노 공정 기술이 제공할 수 있는 차별화된 가치를 연결하여 고객 유치 방안을 제시하는 각도",
        "experienceToPrepare": "기술 산업 관련 리서치 프로젝트, 특정 산업의 시장 동향 분석 보고서 작성 경험, B2B 영업/마케팅 인턴십 경험",
        "seedSentence": "2나노 파운드리 공정의 기술적 우위를 바탕으로 AI 칩 개발사 등 잠재 고객사를 발굴하고 맞춤형 솔루션을 제안하는 각도"
      },
      {
        "name": "AI 기반 스마트홈 생태계 확장 전략",
        "whyForThisRole": "삼성전자는 AI폰과 AI 가전을 동시다발적으로 출시하며 AI를 통한 제품 혁신을 강조하고 있습니다. 전략기획 직무는 이러한 개별 제품들을 연결하여 스마트홈 생태계를 확장하고, 새로운 서비스 가치를 창출하는 전략을 기획할 수 있습니다.",
        "angle": "사용자 데이터 분석을 통해 AI 가전과 스마트폰 연동 시나리오를 구체화하고, 이를 통해 고객에게 제공할 수 있는 차별화된 편의성과 가치를 강조하는 각도",
        "experienceToPrepare": "소비자 행동 분석 프로젝트, 서비스 기획 공모전 참여, IT 제품/서비스 관련 사용자 경험(UX) 리서치 경험",
        "seedSentence": "AI 가전과 스마트폰의 유기적인 연결을 통해 사용자 라이프스타일을 혁신할 수 있는 스마트홈 서비스 모델을 제안하는 각도"
      }
    ],
    "interviewPrep": {
      "questions": [
        {
          "question": "삼성전자가 AI 시대를 맞아 로봇 사업을 강화하는 배경과, 이 사업이 회사의 미래 성장에 어떤 영향을 미칠 것이라고 생각하나요?",
          "direction": "회사가 로봇을 미래 핵심 성장 동력으로 삼고 RX사업추진실을 신설한 배경을 설명하고, AI 기술과의 시너지를 통해 새로운 시장을 창출하고 기존 사업을 강화할 가능성에 대해 답변합니다."
        },
        {
          "question": "최근 삼성전자가 발표한 대규모 국내 투자 계획 중, 전략기획 직무로서 가장 주목하는 분야는 무엇이며 그 이유는 무엇인가요?",
          "direction": "AI 반도체, 로봇 등 특정 투자 분야를 선택하고, 해당 분야의 시장 성장성, 삼성전자의 경쟁 우위, 그리고 본인의 역량이 기여할 수 있는 지점을 연결하여 답변합니다."
        },
        {
          "question": "삼성전자의 DS 부문이 전체 이익의 80% 이상을 차지할 것으로 전망되는 상황에서, DX 부문의 성장 전략은 어떻게 가져가야 한다고 생각하나요?",
          "direction": "DS 부문의 높은 이익 기여도를 인지하고, DX 부문이 AI 가전, AI폰 등 AI 기반 혁신을 통해 프리미엄 시장을 공략하고 새로운 서비스 모델을 발굴하여 수익성을 개선할 방안에 대해 답변합니다."
        },
        {
          "question": "삼성전자가 2030년까지 'AI 자율공장' 전환을 추진하겠다고 밝혔습니다. 이 계획이 회사의 제조 경쟁력과 전략기획 직무에 어떤 의미를 가진다고 생각하나요?",
          "direction": "AI 자율공장 전환이 생산 효율성 극대화, 비용 절감, 품질 향상 등 제조 경쟁력 강화에 기여할 것임을 설명하고, 전략기획 직무로서 이러한 혁신이 사업 성과에 미칠 영향을 분석하고 전략을 수립하는 역할의 중요성을 강조합니다."
        },
        {
          "question": "삼성전자의 파운드리 사업이 2나노 공정 양산과 대형 수주 계약을 통해 성장하고 있습니다. 이 사업의 지속적인 성장을 위해 전략기획 직무로서 어떤 노력이 필요하다고 생각하나요?",
          "direction": "첨단 공정 기술력 확보와 함께 글로벌 팹리스 고객사와의 파트너십 강화, 시장 변화에 선제적으로 대응하는 기술 로드맵 수립의 중요성을 언급하고, 이를 위한 시장 분석 및 투자 전략 수립의 역할을 설명합니다."
        },
        {
          "question": "삼성전자가 AI 대전환(AX)을 핵심 의제로 논의하며 신규 M&A 및 외부 협력 확대를 추진할 것으로 관측됩니다. 전략기획 직무로서 어떤 분야의 M&A나 협력이 가장 효과적일 것이라고 보나요?",
          "direction": "AI, 로봇 등 회사의 미래 성장 동력과 시너지를 낼 수 있는 특정 기술 분야나 시장을 언급하고, 해당 분야의 M&A나 협력이 삼성전자의 경쟁력 강화에 어떻게 기여할 것인지 구체적인 근거를 들어 답변합니다."
        }
      ],
      "primarySources": []
    },
    "sources": [
      {
        "id": 1,
        "title": "tojaman.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHBwe205ZhNO5Nrw4ZCC-5Qlf34vwjqp9wQC_MMp2-mkIv-RQFvTwab1EoxplTaEaZok6hNigorT3Ocx9XsUT9RQXjAh2vd7Mho6JQsC24hp8zxRfE2TWWRQA7HTSVDpB_uKDYA2zqVMP9qKskRyFzYpq7lWLCDalWS",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 2,
        "title": "tistory.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGPhfYYyE73FvnlF9rvp7jWTHgIp6tylThHJCJzIjGgTUuV8bLJJk4QILR8c6dDN8-AsnhjUEkXxBnkpNnO1vADYLJAiEHpK81EVVaD3uAF0qrndtTdz3LFNt_Fph0BFh5Zn3aOgOpB3kN9AwKLmW7fxJFmziHU2dKJIoN-dHQgS8G9I8WCB66rthwxdxdRzF7_-D2__pPL4yDdMEG2l62mDIiLeubD9p3aoQ5tZDUf_z6pCKdXYlomu9rSeGzNIw1G4T7TY-aZfP0TDhNAdqV3Ux34Ymb46Xu9SVYzIhfO2KbevpUFJg==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 3,
        "title": "tistory.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEnqHl7-JfQqUr8NtpRngeXH5XqwgeaHadUAkCXKnWBzKBvqZNX9r-UECvygyq2VhHheaIOQoN8eygYYs2325m7Cc0FxM0veYbXmdzWpmNk0cl0EGMgpt-J5KlBxw==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 4,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEOxzp0zTmhmwQbJYdP0MVfvoo-qP_3y57D47BM2J43D1TYL3_3DHyObtXJvylhfWxnjvMnjnYkVOZ8aUIo6aO7hd3-XGMUZ6VUuCEU-zkP_d_KLfFN6ukGe1lrvE6hmf2_QTyHOrNEEwmV1b-zw22_CF0VXa3TquHNC-gCwlv0Lp_xHzM=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 5,
        "title": "jobkorea.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGAVYCMZzjaRONGtl3i_8HtzMwRpdCikGIZuTqXwcvSjwg6EombRKyo42YzXebZK_YJ95bi8T3YVdy2sseTZwoGb0_uQ4J2jW2HdbSwxCYnaBuM1Q-aRudQZNmh9Zx5IwBrG0oc4I2HM9TAqH4_jxhNGoM9rqLBRvt8mkH8s-rR_kKC",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 6,
        "title": "linkareer.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHCnwGKJYFapvH1bETzUG_Fh_oFPl9ve6I8lyG_oPuMJufB7qW_huuP3UMG77JU4QEopVzrc1-7h6a8DPAoeEeS7l5T4pFUD436aBBMyQHOx0HraQVeEGqamOh_Uta2pg1U95ku",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 7,
        "title": "deepsearch.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFFw_GGgkfWApoxVtY7OMQU-vvXoeE8jYLvPJAQQsCyS_KnN-ki7yyKRswuxzO7RK0YqPTJNebHE5Nb2u0RP1AxQdwGSj3ezuueHL5xbFwAM1pFG4I9iAiuLDfyYpktShQ_msfcxOc=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 8,
        "title": "hankyung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG1ZN70L4kY56XT0X2ORQBaUOtvRt_cJrB3Xi3gt6-yhm7Re7v99vTVV8-vIKL-y0qTU3oDJ6SkgroAQbH8lBx0dGU-eWWk0wgifS8YLrp7kuSm2wCSRCc5hmfZuIxyR2zA--3vhRxAq1s=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 9,
        "title": "irgo.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHboeyKEO1R1KfHwfDREu_wpikmLQjAmWdshu0lcxdgxAdCD4_qWgkWn9itU8uHUxxq2MhYI9wibSBScILWLS7eSiFijsD6-e7y5akwaCLsYXzxjxaGF2maazr_t2Q4pdOpDwGB4NHkNYsgpeLWu6NFwjBLgVPXsNlNrXi-",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 10,
        "title": "dartpoint.ai",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDlVw-kexWCfwBiLhcXCX0CVgTAs003CwgNoNv1P_9gZ5n1pXHNRISvCQ5GmXfWxPt6zblTbYA0VLSsbo24MG_uka3YzQbXrmGPJPHoh867ejBZNewEYh2",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 11,
        "title": "fss.or.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEBzjRwrF9D-5mkxeEAFEyV0Vh8L6qaEssNjtm7XKXXEeeCgTzq21y29S_l-RJccYFOwbuaOcNPSWTeI5kwnFv7PIPUYwb-i-yrIeGWM9phjIJ2MdBpB1Pxz4BUjYwS2hKa-yL81LBQUeXvE46yXU4x9LZ2OVqh1SSqjCqJ-g0LMqpwCi9DuF4dPDk4et5IX6msdfLCxR1AAc3X6037jBcZHlHTPnl4DXp9n9pTDS31UXwOcgkm",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 12,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH7WZ5xYjoff8qPtJ9o1xm4OzsivMhdmwgg02XJIRY-a-VIldzXSoBzR5TszRT5LhzdRV1FwwcOM6diFBFbTLqVOOTPooefV3M1paNiHD3UcqfrMcpG43-9no8aGM_l54UdO3XjC6bQxJGuu--Ckamv5foPAIQuNsV9EqgwuxgQebr7uQ==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 13,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG87HMRfL59OewFyYMG9_VJMgz0MEjD7daj7GZgKpJemWcwdeANeOmezDh2_Gk9SToAfo0CppGyQzH37awWSQFvxy47CqOr-dI5ABxrKNhNMyxhBvtH3B_nHe5ij2V7vILM8h74axCBlPB94j5IYkhg0vbx_3Q-1D-dmy5oSk17fPY-cQ==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 14,
        "title": "wikipedia.org",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH2QWVBaqFyS6MsoWTINeOHHDxBbcOdC4bcgzZqNeQ4OYNUDip0ZvxS-QJkfBOXhc2jQckJ8ZDGJiOqKD9g7m5h34gK9a_53VENBwjBf3lN-5e6RNskKyiD9CtYfwXMYRTN-x_CFFBZ5CyHBM9eDvpehXsT98QYIWAg5-Uvrw==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 15,
        "title": "einfomax.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHbY2N9fX2AR5FPlMmyvsUBr8E6IbTiPtcQhVHM1B14eA8fNjrea_-tj09SEJGN16bGZfn0Lc14qJqpS49QFwy-CskhR71TYaeVQ6B7aU1D5IkOB7EeY83Twj9LllsjEyvr-JlxbFBkgik3RtRENAywYgjoZdQkwo6N",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 16,
        "title": "industrynews.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGcypoak5st8h-KJdA_FcO2mmeCHMddy9lGAckUf-JI6XwVaaQXeaEerTGKkyB-gmi57AQvDldELOfykm0lc5k8CUkBcsxlaG688eIxnoTPUO2t9gbjZ5S5JgHCXJ6QGZULPF6TkX4SkzR6z5yemZKNdCMmesYXarwtZw==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 17,
        "title": "newswire.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELMQZguWUFwCsGOO6C-fwFNb-aJW292nBfEMlb2MTop1SA1SlEntleDRLsHa3hv4YbaGznvutwrqQAnoIwYxrg7zKKst2jk6WdxRqO57f7GgXtL3tV4soGxPXn0sfy2Q7NHv-zMpgqHvZ0PV8=",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 18,
        "title": "zdnet.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHLxzJrivRSj3MTi2L5kBUXY8zcKIR7-Ke1-fpZiX67WBlWoyJDQx8FI5BLKW-l_c1Lahz41s6Yh9lr1UxL-eEUo4bFHqlklrASxyIB3xZ-O51jj2GHZqfTu_9hTJBkaYo8iDJ78w==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 19,
        "title": "youtube.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGxVkkOeGou7Vnwa61P6ueVIz1GE1mypFvnIYrMEdQRnC_Mr-ScQeZJJWGwjvcOq5uetb22y1nH11G6j2h_SyKK_xZEImzh2iRPke-haoa1BvtUkXjssX1kher7oYacdMYRYwxRBQ==",
        "publisher": "vertexaisearch.cloud.google.com"
      },
      {
        "id": 20,
        "title": "donga.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE0WSJXv0Y0EZoKwqtQg3pvdjx21RuLl8oZPJPS9B-2wGDE38Z473gvE_n_KqomiIWWKj9ned5iNVUP8hKq5UueHgoloIogrUvnqcstzK5T-IMy1aVIEtQaDH_xDqQejSkrMtwoCTxBnMQ-8gyn8Anq9NgABvqJEigWcajNww==",
        "publisher": "vertexaisearch.cloud.google.com"
      }
    ],
    "reportMeta": {
      "kind": "COMPANY",
      "schemaVersion": 1,
      "asOf": "2026-09-08",
      "searchQueries": [
        "삼성전자 사업부문 주력 제품 고객 경쟁사",
        "삼성전자 사업보고서 부문별 매출 비중",
        "삼성전자 주요 사업 영역",
        "삼성전자 2026년 사업보고서",
        "삼성전자 2025년 사업보고서",
        "삼성전자 전략기획 조직명",
        "삼성전자 DX부문 전략기획",
        "삼성전자 DS부문 전략기획",
        "삼성전자 미래사업기획단",
        "삼성전자 신사업 추진",
        "삼성전자 전략기획팀 최근 프로젝트",
        "삼성전자 DX부문 조직개편 2025 2026",
        "삼성전자 DS부문 조직개편 2025 2026",
        "삼성전자 신사업 발표 2025 2026"
      ],
      "searchEntryPointHtml": "<style>\n.container {\n  align-items: center;\n  border-radius: 8px;\n  display: flex;\n  font-family: Google Sans, Roboto, sans-serif;\n  font-size: 14px;\n  line-height: 20px;\n  padding: 8px 12px;\n}\n.chip {\n  display: inline-block;\n  border: solid 1px;\n  border-radius: 16px;\n  min-width: 14px;\n  padding: 5px 16px;\n  text-align: center;\n  user-select: none;\n  margin: 0 8px;\n  -webkit-tap-highlight-color: transparent;\n}\n.carousel {\n  overflow: auto;\n  scrollbar-width: none;\n  white-space: nowrap;\n  margin-right: -12px;\n}\n.headline {\n  display: flex;\n  margin-right: 4px;\n}\n.gradient-container {\n  position: relative;\n}\n.gradient {\n  position: absolute;\n  transform: translate(3px, -9px);\n  height: 36px;\n  width: 9px;\n}\n@media (prefers-color-scheme: light) {\n  .container {\n    background-color: #fafafa;\n    box-shadow: 0 0 0 1px #0000000f;\n  }\n  .headline-label {\n    color: #1f1f1f;\n  }\n  .chip {\n    background-color: #ffffff;\n    border-color: #d2d2d2;\n    color: #5e5e5e;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #f2f2f2;\n  }\n  .chip:focus {\n    background-color: #f2f2f2;\n  }\n  .chip:active {\n    background-color: #d8d8d8;\n    border-color: #b6b6b6;\n  }\n  .logo-dark {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #fafafa 15%, #fafafa00 100%);\n  }\n}\n@media (prefers-color-scheme: dark) {\n  .container {\n    background-color: #1f1f1f;\n    box-shadow: 0 0 0 1px #ffffff26;\n  }\n  .headline-label {\n    color: #fff;\n  }\n  .chip {\n    background-color: #2c2c2c;\n    border-color: #3c4043;\n    color: #fff;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #353536;\n  }\n  .chip:focus {\n    background-color: #353536;\n  }\n  .chip:active {\n    background-color: #464849;\n    border-color: #53575b;\n  }\n  .logo-light {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #1f1f1f 15%, #1f1f1f00 100%);\n  }\n}\n</style>\n<div class=\"container\">\n  <div class=\"headline\">\n    <svg class=\"logo-light\" width=\"18\" height=\"18\" viewBox=\"9 9 35 35\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M42.8622 27.0064C42.8622 25.7839 42.7525 24.6084 42.5487 23.4799H26.3109V30.1568H35.5897C35.1821 32.3041 33.9596 34.1222 32.1258 35.3448V39.6864H37.7213C40.9814 36.677 42.8622 32.2571 42.8622 27.0064V27.0064Z\" fill=\"#4285F4\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 43.8555C30.9659 43.8555 34.8687 42.3195 37.7213 39.6863L32.1258 35.3447C30.5898 36.3792 28.6306 37.0061 26.3109 37.0061C21.8282 37.0061 18.0195 33.9811 16.6559 29.906H10.9194V34.3573C13.7563 39.9841 19.5712 43.8555 26.3109 43.8555V43.8555Z\" fill=\"#34A853\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M16.6559 29.8904C16.3111 28.8559 16.1074 27.7588 16.1074 26.6146C16.1074 25.4704 16.3111 24.3733 16.6559 23.3388V18.8875H10.9194C9.74388 21.2072 9.06992 23.8247 9.06992 26.6146C9.06992 29.4045 9.74388 32.022 10.9194 34.3417L15.3864 30.8621L16.6559 29.8904V29.8904Z\" fill=\"#FBBC05\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 16.2386C28.85 16.2386 31.107 17.1164 32.9095 18.8091L37.8466 13.8719C34.853 11.082 30.9659 9.3736 26.3109 9.3736C19.5712 9.3736 13.7563 13.245 10.9194 18.8875L16.6559 23.3388C18.0195 19.2636 21.8282 16.2386 26.3109 16.2386V16.2386Z\" fill=\"#EA4335\"/>\n    </svg>\n    <svg class=\"logo-dark\" width=\"18\" height=\"18\" viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\">\n      <circle cx=\"24\" cy=\"23\" fill=\"#FFF\" r=\"22\"/>\n      <path d=\"M33.76 34.26c2.75-2.56 4.49-6.37 4.49-11.26 0-.89-.08-1.84-.29-3H24.01v5.99h8.03c-.4 2.02-1.5 3.56-3.07 4.56v.75l3.91 2.97h.88z\" fill=\"#4285F4\"/>\n      <path d=\"M15.58 25.77A8.845 8.845 0 0 0 24 31.86c1.92 0 3.62-.46 4.97-1.31l4.79 3.71C31.14 36.7 27.65 38 24 38c-5.93 0-11.01-3.4-13.45-8.36l.17-1.01 4.06-2.85h.8z\" fill=\"#34A853\"/>\n      <path d=\"M15.59 20.21a8.864 8.864 0 0 0 0 5.58l-5.03 3.86c-.98-2-1.53-4.25-1.53-6.64 0-2.39.55-4.64 1.53-6.64l1-.22 3.81 2.98.22 1.08z\" fill=\"#FBBC05\"/>\n      <path d=\"M24 14.14c2.11 0 4.02.75 5.52 1.98l4.36-4.36C31.22 9.43 27.81 8 24 8c-5.93 0-11.01 3.4-13.45 8.36l5.03 3.85A8.86 8.86 0 0 1 24 14.14z\" fill=\"#EA4335\"/>\n    </svg>\n    <div class=\"gradient-container\"><div class=\"gradient\"></div></div>\n  </div>\n  <div class=\"carousel\">\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGuu9xPBDwJidGhdBdQ_0yG_neplu4pzqhbCVlWvVW8yIVgdx7iZ11ZuEqRxKFABd8e-EvxqqeI_YJEVPZVUqXMYogl1ltSpai67a5lOf-UeCCDPOxNSnK2iVgm9iXqKi3UilMyhDfp7vD1hCwsOGbO-SHo7R7j2UlX5sr4QQQKAWU5YMFXn13rJL5g50Dr0JeO44qbtOJPCrkeMkBNSad5nvvYAXrOCGkICoYJ_xOkV1zndw1iWBfHopAzMlCUYCubzakxif2jfXrHMhDhIQE0NGHm5_hPU7Sv0xhOEbzaenyToc=\">삼성전자 2026년 사업보고서</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGWePyzWfptkoerTDDPCGNMcM3gb2r3be4sYhJOTvaYo36gfAi8i9XUBfaqtmCIHLWMir-oYNNF3isMaKJGQvGCYzmD50ZU9amA80yiFFN8ORtXSWEkTnzegp8nPNpxI2B5mWzYbrhqryEyUX111GruOUQ6xYuyZeNIsiiqrkZBhmqaYOEwVqamghAL-L1VajuO1yq1TWInQ236NZlcFLWfxqWg_xnVuby8_0wq-A4TjYTlJIR6542YyaPKVmfVPQpU3Tloqhv_t6cdd3De-gFqkZDmx3ejjuYNZaQuLLwCK78=\">삼성전자 주요 사업 영역</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHNc10eJDF8OSaGrY61GjXPgfkR5cDZhRTtS8d2xwACmHtKCbdWsJ9K8bU1KXuv-9gwDnIG15OCeoz5VFxw7gGJO6QClEZMHDlz6qNKROg-C71PbuNwUYuUzrdYwQL0hN5hxsaMgUoxZcKosJs3wPu0AJWm53JUpjCG18NX_IeP_vzYZuW8_2_uGTDe4Bk-uhngDO9gPmDmXBuyPk017COIM1PwIPb3zmrmmC15fe3bO8bjlk3Yx7INtN73Ed3SKsJkjcme0XqE7Yprwg9-KFjOAP19vob7sUIkE1-NPI9wF3kYttoWg895CpEWnwK7lQNlW7dlZGqNNE1v-l65lE803lIxD_SYIC9a29hrPxb7z1FI2uPibRBpLe9rO2wJcLnSvQ==\">삼성전자 사업부문 주력 제품 고객 경쟁사</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEu4AJQo2CcU16bz4k3jTTVqDDKJsm-FtYLtZI6Gf2mmJlIikNQN8pnTT4Yhh_FcbQtU5rHgG-_rg9Avyz4Oe3FnsQrpjVyziHqT4nv_qp6JUATZD8jkd3erykMQU81XoYoOHCdoxujLrcarW0WcjKTrWCmbsbNHU6ra3Z3lQvdG_57dIcKyVgNfCY8_GRco6rmgzdxUiVOTRtsktEZz47qtfUzOpXv8Ld5NrxYm891eGqehHCaUy1ESYuUDVicAe5mtf0EAK91ea85jkpjrLZQjgZgnzM1BXxhrRLud9EURhc7n45QyiVkbwkszIGWZ9IM77DD4VQRhdNvKCGu4Sks-NN0V7WeT2zdXXkWnqazUo365SoH-5mo\">삼성전자 사업보고서 부문별 매출 비중</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTgCnv_i4AIABzZ9MR2ot7e4lS-UsWoF0YtqRVs3l69yS26avVdRPe9vW2StfPPZpphIvuBsHLLJ_Sd6eOr-4988niBTrFAlzUhWMAUf9O5htow0-x2y6b4p7ICeNYjB2dnoffIqlSOpOiLi9mUnjWKQaBbEb5BFpKt1sF3qjnqOiukGPgIEqnNx_ERkNnmKYsxAgEYctVnmx5Lr_Rcfzxn_MAI1SYGo6INxMXzD8B7RBzpjZgbO2d1-WRGcyVeZFh9Qqj7tuh94ylxrP6qxmWninCtCo9bkcjxG9IbACdqyxa1ZU=\">삼성전자 2025년 사업보고서</a>\n  </div>\n</div>\n",
      "linkedResumeAnalysisId": null,
      "repaired": false
    }
  },
};
