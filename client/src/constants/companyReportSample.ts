import type { CompanyReportData } from "@/types/companyReport";
import { COMPANY_REPORT_SAMPLE_COMPANY, COMPANY_REPORT_SAMPLE_JOB_ROLE } from "./companyReportSampleMeta";

/**
 * 공개 샘플 리포트(/company-report?sample=1, 랜딩 소개 섹션).
 * scripts/manual/company-analysis-probe.mjs --out 으로 생성한 실제 리포트를 사용자가 검수해 굳힌 것이다.
 * 갱신: node --env-file=.env scripts/manual/company-analysis-probe.mjs "<회사>" "<직무>" --out sample.json
 *       → result 에서 analysisMeta 를 뺀 나머지를 report 에 붙여 넣는다(searchEntryPointHtml 포함 — 검색 그라운딩 약관).
 *       서버가 반환 전에 거는 tidyCompanyReport 가 프로브 결과에도 이미 적용돼 있다.
 * 현재 샘플: 2026-10-12 실행(조사 3묶음 병렬 → 구성, 경쟁사 비교·경영진 메시지·용어 풀이 포함). 문장·출처는 생성 결과 그대로다.
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
      "oneLiner": "반도체와 완성품을 아우르는 글로벌 종합 전자 기업",
      "keywords": [
        "고대역폭메모리",
        "파운드리",
        "온디바이스AI",
        "사업지원실",
        "로봇공학"
      ],
      "asOf": "2026-10-12",
      "positionInIndustry": "메모리 반도체와 스마트폰 출하량에서 글로벌 선두권을 유지하고 있으며, 파운드리와 고대역폭메모리 시장에서는 기술 경쟁력 격차를 좁히기 위해 전사 역량을 집중하고 있습니다."
    },
    "businessMap": {
      "summary": "완제품을 만드는 DX 부문과 반도체 부품을 공급하는 DS 부문이 양대 축을 이루며, 디스플레이(SDC)와 전장·오디오(Harman)가 뒤를 받칩니다. 메모리와 완제품 사업에서 창출된 대규모 현금을 바탕으로 파운드리, AI 인프라, 차세대 로봇 등 대규모 설비투자와 신성장 동력에 재투자하는 순환 구조를 가집니다.",
      "segments": [
        {
          "name": "DX(Device eXperience)",
          "whatItDoes": "스마트폰, TV, 냉장고, 세탁기 등 완성품 가전과 통신 단말기를 전 세계 소비자 및 기업에 공급합니다.",
          "weight": "2025년 기준 전사 매출의 약 52%",
          "phase": "성숙",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "DS(Device Solutions)",
          "whatItDoes": "AI 서버 및 모바일용 D램, 낸드 플래시 메모리와 모바일AP를 개발하고 위탁 생산(파운드리)을 제공합니다.",
          "weight": "2025년 기준 전사 매출의 약 36%",
          "phase": "전환",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "SDC(삼성디스플레이)",
          "whatItDoes": "스마트폰 및 IT 기기용 중소형 OLED 패널을 글로벌 완제품 제조사에 공급합니다.",
          "weight": "2025년 기준 전사 매출의 약 8%",
          "phase": "성숙",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "Harman",
          "whatItDoes": "차량용 디지털 콕핏, 카오디오 등 자동차 전장부품과 소비자용 오디오 기기를 생산해 판매합니다.",
          "weight": "2025년 기준 전사 매출의 약 4%",
          "phase": "성장",
          "sourceIds": [
            1
          ]
        }
      ],
      "customersAndCompetitors": "주요 고객으로는 애플, 퀄컴, 베스트바이, 도이치텔레콤, 버라이즌 등이 있으며, 반도체 분야에서는 SK하이닉스·마이크론·TSMC, 완제품 분야에서는 애플과 경쟁합니다."
    },
    "competitorComparison": {
      "summary": "메모리 분야에서는 SK하이닉스와, 파운드리에서는 TSMC와 격돌하며, 스마트폰 시장에서는 애플과 프리미엄 점유율을 두고 맞붙습니다.",
      "items": [
        {
          "name": "SK하이닉스",
          "overlap": "인공지능 가속기용 HBM 및 범용 서버 D램 시장에서 정면으로 맞붙습니다.",
          "difference": "SK하이닉스가 고대역폭메모리 등 메모리 반도체 단일 축에 역량을 집중하는 반면, 삼성전자는 파운드리와 가전, 스마트폰까지 포괄하는 포트폴리오를 보유하고 있습니다.",
          "sourceIds": [
            8
          ]
        },
        {
          "name": "TSMC",
          "overlap": "글로벌 팹리스 고객을 유치하는 첨단 미세공정 파운드리 위탁생산 시장에서 경쟁합니다.",
          "difference": "TSMC는 고객과 경쟁하지 않는 순수 위탁생산 체제인 반면, 삼성전자는 메모리·로직 설계·파운드리·패키징을 자체적으로 한 번에 처리하는 종합 반도체 구조를 지닙니다.",
          "sourceIds": [
            8
          ]
        },
        {
          "name": "애플",
          "overlap": "글로벌 프리미엄 스마트폰 및 스마트 디바이스 생태계 시장에서 경쟁합니다.",
          "difference": "애플이 독자 운영체제 기반의 고가 단일 라인업에 집중하는 반면, 삼성전자는 안드로이드 생태계에서 폴더블부터 중저가 라인업까지 폭넓은 가격대와 제품군을 전개합니다.",
          "sourceIds": [
            8
          ]
        }
      ],
      "whyHere": "단일 제품군에 의존하지 않고 메모리·파운드리·완제품 전 주기를 자체 조율할 수 있는 유일한 복합 포트폴리오 기업입니다. 전략기획 직무에서는 부문 간 연계를 통해 전사 시너지를 극대화하고 유연한 자원 배분을 기획할 수 있는 기회가 열려 있습니다."
    },
    "focusBusinesses": {
      "statedDirection": "기술의 본질과 품질 완성도를 바탕으로 근원적 경쟁력을 회복하고 전사 사업 체질을 인공지능 중심으로 혁신하는 데 초점을 둡니다.",
      "items": [
        {
          "name": "차세대 HBM4 양산 및 AI 반도체 공급",
          "whatChanged": "10나노급 6세대 D램 공정을 적용한 6세대 고대역폭메모리 HBM4를 양산 출하하며 주도권 탈환에 나섰습니다.",
          "evidence": "2026년 2월 1c D램 공정 기반 HBM4 세계 최초 출하 및 첨단 공정 시설투자 대규모 집행",
          "whyNow": "빅테크 기업들의 인공지능 데이터센터 인프라 확대로 고성능 메모리 공급 경쟁이 본격화되었기 때문입니다.",
          "relevanceToRole": "직접 관련되며 차세대 반도체 포트폴리오의 가격 협상과 전사 설비투자 우선순위를 결정하는 기준이 됩니다.",
          "sourceIds": [
            2,
            5
          ]
        },
        {
          "name": "RX 기반 지능형 로봇 사업 본격화",
          "whatChanged": "레인보우로보틱스를 연결 종속회사로 편입하고 로봇 컨트롤타워를 직속 실급 조직으로 격상했습니다.",
          "evidence": "2024년 12월 레인보우로보틱스 콜옵션 행사로 지분 35% 확보 및 2026년 7월 DX부문장 직속 RX사업추진실 신설",
          "whyNow": "완제품 제조 노하우와 인공지능 모델을 결합해 미래 제조 혁신과 서비스 로봇 시장을 선점하기 위한 조치입니다.",
          "relevanceToRole": "직접 관련되며 인수합병 이후 종속회사의 사업 통합과 신규 로봇 사업 모델 기획에 전략 역량이 투입됩니다.",
          "sourceIds": [
            2
          ]
        },
        {
          "name": "플랙트그룹 인수를 통한 데이터센터 공조 진출",
          "whatChanged": "독일 공조설비 전문 기업 인수를 완료하며 기존 가전 사업을 데이터센터 및 산업용 냉각 시장으로 확장했습니다.",
          "evidence": "2025년 11월 독일 플랙트그룹 인수 절차 완료 공식 발표",
          "whyNow": "AI 서버 가동에 따른 발열 제어 솔루션 수요가 급증하여 기업간거래 고부가가치 냉조 시장 선점이 중요해졌기 때문입니다.",
          "relevanceToRole": "간접 관련되며 B2B 신성장 동력의 매출 기여도 분석과 사업 포트폴리오 재편 관리에 반영됩니다.",
          "sourceIds": [
            5
          ]
        }
      ],
      "translatedTalentKeywords": [
        {
          "stated": "인재제일",
          "meaning": "임직원의 역량을 적재적소의 프로젝트에 투입해 고난도 기술 난제를 돌파하도록 독려하는 조직 운영"
        },
        {
          "stated": "최고지향",
          "meaning": "경쟁사와의 기술 격차를 기술 본질과 선단 공정 수율로 증명해 시장 1위를 지키려는 태도"
        },
        {
          "stated": "변화선도",
          "meaning": "완제품과 부품 전 영역에 걸쳐 기존 업무 체계를 인공지능 기반으로 선제 전환하는 위기의식"
        },
        {
          "stated": "정도경영",
          "meaning": "투명한 공시와 원칙에 기반한 전략적 의사결정을 통해 대내외 신뢰를 확보하는 체계"
        },
        {
          "stated": "상생추구",
          "meaning": "글로벌 공급망 파트너 및 고객사와 긴밀한 협력 생태계를 구축해 산업 전반의 기술 확장을 유도하는 자세"
        }
      ]
    },
    "leadershipMessages": {
      "items": [
        {
          "occasion": "창립 56주년 기념사",
          "speaker": "전영현 대표이사 부회장",
          "when": "2025-10",
          "keywords": [
            "근원적 경쟁력 회복",
            "AI 드리븐 컴퍼니",
            "품질의 완성도"
          ],
          "quote": "초심으로 돌아가 기술의 본질과 품질의 완성도에 집중해 근원적 경쟁력을 회복해야 한다",
          "meaning": "단기 실적 회복에 만족하지 않고 핵심 제품의 본원적 기술 우위를 전략 방향으로 설정하라는 주문입니다.",
          "sourceIds": [
            9
          ]
        },
        {
          "occasion": "2026년 신년사",
          "speaker": "전영현 대표이사 부회장",
          "when": "2026-01",
          "keywords": [
            "원스톱 솔루션",
            "AI 반도체 수요",
            "AI 시대 선도"
          ],
          "quote": "삼성전자는 로직부터, 메모리, 파운드리, 선단 패키징까지 '원스톱 솔루션'이 가능한 세계 유일의 반도체 회사다",
          "meaning": "사업부 간 경계를 허물고 턴키 역량을 결합한 종합 패키징 제안을 전사 전략의 차별점으로 삼겠다는 뜻입니다.",
          "sourceIds": [
            9
          ]
        }
      ]
    },
    "financialSnapshot": {
      "listed": true,
      "market": "유가증권시장 · 삼성전자",
      "revenueTrend": "2023년 반도체 다운턴으로 258조 원대로 축소되었으나 메모리 수요 회복과 AI 서버 확대로 2024년 300조 원을 돌파하고 2025년 333조 원대까지 성장세를 이어갔습니다.",
      "profitTrend": "2023년 6조 원대에 머물던 영업이익이 2024년 32조 원대로 턴어라운드한 뒤 2025년 반도체 부문 실적 개선에 힘입어 43조 원을 웃돌며 반등했습니다.",
      "keyFigures": [
        {
          "label": "매출",
          "value": "333조 6,059억 원",
          "period": "2025년 연간",
          "sourceIds": [
            3
          ]
        },
        {
          "label": "영업이익",
          "value": "43조 6,011억 원",
          "period": "2025년 연간",
          "sourceIds": [
            3
          ]
        },
        {
          "label": "시설투자",
          "value": "52조 7,000억 원",
          "period": "2025년 연간",
          "sourceIds": [
            2
          ]
        },
        {
          "label": "연구개발비용",
          "value": "37조 7,000억 원",
          "period": "2025년 연간",
          "sourceIds": [
            2
          ]
        }
      ],
      "marketView": "2026년 10월 기준 주가는 25만 원 선에 안착하며 보통주 시가총액 약 1,500조 원 안팎을 형성하고 있으며 3분기 대규모 잠정 영업이익 공시와 주주환원 정책이 맞물려 있습니다.",
      "recentDisclosures": [
        {
          "title": "2026년 2분기 정기 분기배당 결의(주당 374원, 총 2조 4,559억 원)",
          "when": "2026-07",
          "sourceIds": [
            3
          ]
        },
        {
          "title": "2026년 3개년 잉여현금흐름 기반 주주환원 방안 및 자기주식 취득 결의 자율공시",
          "when": "2026-08",
          "sourceIds": [
            3
          ]
        },
        {
          "title": "2026년 3분기 잠정 연결 매출액 195조 원, 영업이익 107.4조 원 공시",
          "when": "2026-10",
          "sourceIds": [
            3
          ]
        },
        {
          "title": "2026년 3분기 실적발표 컨퍼런스콜 개최 안내",
          "when": "2026-10",
          "sourceIds": [
            3
          ]
        }
      ],
      "fundingNote": "",
      "forApplicant": "대규모 현금 창출력을 바탕으로 설비투자와 R&D에 천문학적 자본을 집행하고 있어 재무 건전성을 관리하고 사업부별 투자 효율을 검증할 기획 인력 수요가 높습니다."
    },
    "currentIssues": [
      {
        "title": "사장단 및 임원 인사 단행",
        "when": "2025-11",
        "fact": "전영현 DS부문장과 노태문 DX부문장의 투톱 체제를 유지하며 161명의 임원 승진을 단행했습니다.",
        "whyItMatters": "사업부문별 리더십의 연속성을 확보하는 동시에 조직 쇄신과 신성장 사업 추진 속도를 높이기 위함입니다.",
        "forApplicant": "투톱 리더십 체제 아래 부문별 전략 우선순위와 보고 체계를 이해하는 기초 정보가 됩니다.",
        "sourceIds": [
          5
        ]
      },
      {
        "title": "노사 임금협약 체결 합의",
        "when": "2026-03",
        "fact": "전국삼성전자노동조합 찬반 투표를 거쳐 DS부문 특별성과급 지급을 포함한 임금협약 체결을 마무리했습니다.",
        "whyItMatters": "생산 차질 우려를 해소하고 반도체 공장 가동과 선단 공정 수율 확보에 집중할 수 있는 내부 안정을 확보했습니다.",
        "forApplicant": "내부 노사 협약 결과가 고정비 및 인건비 예산 편성에 미치는 영향을 파악해야 합니다.",
        "sourceIds": [
          5
        ]
      },
      {
        "title": "엔비디아 HBM4 공급 가격 협상",
        "when": "2026-10",
        "fact": "엔비디아 루빈 가속기 플랫폼 진입을 계기로 차세대 고대역폭메모리 HBM4의 공급 가격 협상을 추진했습니다.",
        "whyItMatters": "AI 반도체 밸류체인 내 주도권을 되찾고 고부가가치 메모리 마진율을 방어하는 핵심 분기점입니다.",
        "forApplicant": "단일 고객사에 대한 가격 책정 모델과 손익 영향도를 추정하는 전략적 관점이 요구됩니다.",
        "sourceIds": [
          5
        ]
      }
    ],
    "roleInContext": {
      "whereItSits": "전사 차원의 의사결정을 조율하는 사업지원실 산하 전략팀 또는 DX부문 경영지원담당 기획 조직에 소속됩니다.",
      "problemsItSolves": [
        "각 사업부(MX, DA, VD, 메모리, 파운드리)의 월간·분기별 매출 및 영업이익 실적 지표 취합 및 변동 원인 분석",
        "사업지원실 산하 M&A팀의 기술 기업 지분 투자 및 인수 대상 사전 시장 리서치 지원",
        "글로벌 전략협의회 및 사장단 회의를 위한 부문별 산업 동향 및 경쟁사(TSMC, SK하이닉스) 실적 비교 보고서 작성",
        "각 사업부의 AI 전환(AX) 실행 조직 예산 편성 및 과제 진척도 모니터링"
      ],
      "whyHiringNow": "사업지원실 정규화와 전사 AI 전환 및 차세대 반도체 증설 투자가 겹치며 다각화된 사업부의 자원 배분을 조율할 실무 인력이 필요해진 것으로 추론됩니다.",
      "recentNewsForRole": [
        {
          "title": "상설 사업지원실 체제 개편 및 M&A팀 신설",
          "when": "2025-11",
          "fact": "사업지원TF를 8년 만에 정규 사업지원실로 개편하고 전략팀, 경영진단팀, 피플팀 편제와 산하 M&A팀을 구축했습니다.",
          "whyForRole": "전사 전략기획의 지휘 본부가 정규화된 만큼 일관된 자본 배분 및 인수합병 전략 보고가 요구됩니다.",
          "sourceIds": [
            2,
            4
          ]
        },
        {
          "title": "하반기 글로벌 전략협의회 개최",
          "when": "2025-12",
          "fact": "본사 경영진과 주요 글로벌 법인장 300여 명이 모여 부문별 시황 점검 및 중장기 신성장 동력을 논의했습니다.",
          "whyForRole": "글로벌 거점별 실적과 중장기 과제를 조율하는 회의체 지원이 기획 직무의 핵심 실무임을 보여줍니다.",
          "sourceIds": [
            4
          ]
        },
        {
          "title": "전사 AX팀 신설 및 디지털 트윈센터 구축",
          "when": "2025-11",
          "fact": "DX부문 사업부와 경영지원 산하에 AX팀을 두고 DS부문에 가상화를 위한 디지털 트윈센터를 세웠습니다.",
          "whyForRole": "제조 및 경영 전반의 인공지능 전환 과제를 사업부별 핵심성과지표로 연결하는 기획 관리가 필요합니다.",
          "sourceIds": [
            2,
            4
          ]
        }
      ],
      "postingReading": ""
    },
    "opportunitiesAndRisks": {
      "opportunities": [
        {
          "headline": "원스톱 턴키 솔루션 경쟁력",
          "text": "메모리와 로직 파운드리, 선단 패키징을 일괄 처리할 수 있는 구조는 고객사의 개발 기간을 크게 단축시킵니다. 차세대 인공지능 가속기 시장에서 단일 칩 솔루션 공급 능력을 입증하면 빅테크 고객 락인 효과를 누릴 수 있습니다. **자체 턴키 공정을 통한 AI 반도체 공급 역량은 전사 수주 규모를 획기적으로 키우는 기회 요인입니다.**",
          "sourceIds": [
            9
          ]
        },
        {
          "headline": "로봇 종속회사 기반 제조 혁신",
          "text": "레인보우로보틱스 편입과 RX사업추진실 신설로 지능형 로봇 기술을 사내 제조 인프라에 직접 투입할 발판을 마련했습니다. 구미사업장 로봇 데이터 팩토리 구축 등을 통해 제품 조립 원가를 절감하고 공정 효율을 높일 수 있습니다. **로봇 기술 내재화는 서비스 완제품 상용화와 자체 제조 공정 고도화를 동시에 달성하는 계기가 됩니다.**",
          "sourceIds": [
            2
          ]
        },
        {
          "headline": "전 사업 영역의 실질적 AI 전환",
          "text": "각 사업부 산하에 전담 AX팀을 구축하고 경영지원 조직까지 인공지능 전환을 일괄 추진하고 있습니다. 생산 라인 가상화와 스마트폰 및 가전의 온디바이스 AI 결합은 제품 판가 상승과 부가가치 증대로 이어집니다. **조직 전반의 인공지능 역량 내재화는 완제품과 제조 인프라의 수익성을 구조적으로 끌어올립니다.**",
          "sourceIds": [
            2,
            4
          ]
        }
      ],
      "risks": [
        {
          "headline": "선단 파운드리 점유율 격차",
          "text": "TSMC가 70%가 넘는 점유율로 글로벌 빅테크 수주를 독식하는 상황에서 파운드리 시장 점유율은 한 자릿수에 머물러 있습니다. 수주 물량이 부족하면 첨단 팹 가동률이 저하되어 대규모 시설투자가 감가상각 부담으로 되돌아올 수 있습니다. **파운드리 부문의 고객 다변화 실패는 막대한 설비투자 비용의 회수 기간을 지연시키는 부담 요인입니다.**",
          "sourceIds": [
            8
          ]
        },
        {
          "headline": "스마트폰 매출 점유율 열세",
          "text": "출하량 기준으로는 세계 1위를 수성하고 있으나 전체 스마트폰 매출 점유율에서는 프리미엄 중심의 애플에 크게 뒤처져 있습니다. 프리미엄 제품군 비중이 정체될 경우 모바일 사업부의 수익성 방어가 구조적 한계에 부딪힐 수 있습니다. **출하량 대비 낮은 매출 점유율을 극복하기 위해 프리미엄 라인업의 평균판매단가 개선이 시급한 과제입니다.**",
          "sourceIds": [
            8
          ]
        },
        {
          "headline": "대규모 설비투자 회수 부담",
          "text": "연간 50조 원 이상의 시설투자와 30조 원 후반대의 R&D 비용을 지속 투입하고 있어 업황 변동에 따른 재무 리스크 관리가 요구됩니다. 메모리 다운턴이 재발하거나 차세대 제품 수율 안정화가 지연될 경우 현금흐름 변동성이 커질 위험이 있습니다. **과감한 선제 투자가 실적으로 이어지지 못할 경우 전사 잉여현금흐름과 주주환원 여력이 압박받을 수 있습니다.**",
          "sourceIds": [
            2,
            3
          ]
        }
      ]
    },
    "businessCandidates": [
      {
        "name": "레인보우로보틱스 인수 후 제조 팩토리 연계",
        "whyForThisRole": "인수합병 이후 종속회사를 기존 사업부(구미 공장 및 DX부문)와 물리적으로 결합해 시너지를 내는 사후 통합(PMI) 전략 실무와 직결됩니다.",
        "angle": "외부 기술 인수 후 기존 제조 현장에 이식해 생산성을 높이는 자원 배분 관점",
        "experienceToPrepare": "경영학 수업이나 학회 프로젝트에서 진행한 M&A 기업 가치 평가 또는 제조 공정 개선 전략 분석",
        "seedSentence": "로봇 하드웨어 제조 역량을 기존 공장 인프라와 결합할 때 발생하는 공정 통합 병목을 운영 지표 관점에서 검토하는 각도"
      },
      {
        "name": "글로벌 데이터센터 향 공조 B2B 포트폴리오 확장",
        "whyForThisRole": "플랙트그룹 인수를 통해 B2C 중심 가전(DA) 영역을 AI 인프라 산업용 냉각 시장으로 확대한 사업 포트폴리오 다각화 사례입니다.",
        "angle": "소비재 완제품 중심 사업부가 산업용 공조 인프라로 고객군을 전환할 때 필요한 수익 모델 분석 관점",
        "experienceToPrepare": "B2B 시장 분석 공모전 참여나 산업재 기업의 고객 세분화 및 영업 전략 리서치 경험",
        "seedSentence": "데이터센터 전력 및 냉각 효율 솔루션을 반도체 공급 패키지와 묶어 제안할 때의 전사적 교차 판매 가치를 분석하는 각도"
      }
    ],
    "interviewPrep": {
      "questions": [
        {
          "question": "SK하이닉스가 HBM 시장에서 앞서가는 상황에서 삼성전자가 내세울 수 있는 전략적 우위는 무엇인가요?",
          "direction": "메모리 단일 제품 경쟁에 매몰되지 않고 로직, 파운드리, 첨단 패키징을 자체적으로 한 번에 수행할 수 있는 원스톱 턴키 솔루션을 강조해야 합니다. 고객사의 설계 복잡성을 낮추고 공급망을 단일화해 줄 수 있는 종합 반도체 기업만의 차별점을 설명하세요."
        },
        {
          "question": "TSMC와의 파운드리 점유율 격차를 줄이기 위해 전략기획 관점에서 무엇을 우선 검토해야 합니까?",
          "direction": "단기적인 가동률 경쟁보다는 차세대 선단 노드 수율의 안정적 확보와 대형 팹리스 고객 맞춤형 지원 체계를 짚어야 합니다. 천문학적인 시설투자 집행 과정에서 라인 전환의 유연성을 확보해 감가상각 리스크를 관리하는 방안을 제시하세요."
        },
        {
          "question": "스마트폰 시장에서 출하량 1위임에도 매출 점유율이 애플에 뒤처지는 구조를 어떻게 개선해야 할까요?",
          "direction": "중저가 제품군을 통한 글로벌 시장 점유율 방어 기반 위에서 온디바이스 AI 기능 고도화로 프리미엄 플래그십의 평균판매단가를 끌어올리는 믹스 개선 전략을 말해야 합니다. 하드웨어 스펙 경쟁을 넘어 AI 생태계 연계를 통한 기기 교체 수요 자극 방안을 언급하세요."
        },
        {
          "question": "사업지원실 정규화와 M&A팀 신설이 전사 자원 배분에 미치는 긍정적 효과는 무엇이라고 봅니까?",
          "direction": "단기적인 부문별 이해관계를 넘어 전사 유보금을 로봇이나 냉각 솔루션 같은 고부가가치 신수종 사업에 전략적으로 재배분할 수 있는 체계가 정비되었음을 밝히세요. 비유기적 성장과 기존 주력 사업 간의 시너지를 조율하는 기획적 안정성을 강조하세요."
        },
        {
          "question": "연간 50조 원이 넘는 설비투자가 진행되는 상황에서 재무 건전성과 투자 효율을 관리할 전략적 기준은 무엇입니까?",
          "direction": "메모리 업황의 순환 주기를 감안한 탄력적 투자 집행과 잉여현금흐름의 철저한 관리를 제시해야 합니다. 차세대 제품 양산 시점과 주요 빅테크의 설비 확충 계획을 연동해 설비투자 집행 속도를 제어하는 시나리오 기반 기획 역량을 보여주세요."
        }
      ],
      "primarySources": [
        {
          "label": "사업보고서 및 공시 자료",
          "url": "https://dart.fss.or.kr"
        },
        {
          "label": "회사 공식 IR 자료실",
          "url": "https://www.samsung.com/sec/ir"
        },
        {
          "label": "회사 공식 뉴스룸",
          "url": "https://newsroom.samsung.com/kr"
        },
        {
          "label": "DX부문 채용 페이지",
          "url": "https://www.samsung.com/sec/aboutsamsung/recruitment/"
        }
      ]
    },
    "glossary": [
      {
        "term": "HBM",
        "plain": "D램을 수직으로 높게 쌓아 데이터 처리 속도를 획기적으로 높인 메모리"
      },
      {
        "term": "파운드리",
        "plain": "반도체 설계 전문 기업의 도면을 받아 반도체를 대신 위탁 생산하는 사업"
      },
      {
        "term": "온디바이스 AI",
        "plain": "외부 인터넷 연결 없이 스마트폰이나 가전 기기 내부에서 직접 구동되는 인공지능"
      },
      {
        "term": "디지털 트윈",
        "plain": "실제 공장을 가상 컴퓨터 공간에 쌍둥이처럼 똑같이 구현해 시뮬레이션하는 기술"
      },
      {
        "term": "원스톱 솔루션",
        "plain": "반도체의 설계, 메모리 제작, 위탁 생산, 패키징 전 과정을 한 회사에서 끝내는 방식"
      }
    ],
    "sources": [
      {
        "id": 1,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkP4GVTssJnTTFbFMPapWSEHCTOUzNstc7rjcsnaEJQJ8KWCr7SnPJ61lLwuGpajSqRq4p-fHfjhQKGTEM9BWMrmyBY-Yrj44tu1_g-CY9ug40ocZTLwfxSPeuDtch90fRxXDy5WDoPgjYodxas7xEsWStoUvUBoB7RIb67xW6uUAWQBxOGDdos7XXEm55mJs=",
        "publisher": "samsung.com",
        "excerpt": "(2026-03) 사업 부문은 제품 특성에 따라 완제품을 담당하는 DX(Device eXperience: 스마트폰·태블릿·TV·모니터·냉장고·세탁기·에어컨 등), 반도체 부품을 담당하는 DS(Device Solutions: DRAM, NAND Fla…"
      },
      {
        "id": 2,
        "title": "hankyung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE5X0J3s47VdX45GFYnW-avEBSTlOa3djbaaWZpk8hOFg6zWTH5vAMy1VzHQrlRGonkgC7uRogzNiUQ_TGDy3MQXvklDkOqcdAaA1Jyb5xYtEBMh3JPgF4QGZpjjE9aX2S-RqM=",
        "publisher": "hankyung.com",
        "excerpt": "(2025-11) 전사 컨트롤타워 역할을 하던 임시 조직 '사업지원TF'를 8년 만에 상설 조직인 '사업지원실'로 개편하고, 산하에 전략팀·경영진단팀·피플팀 3개 팀 편제 구축 및 박학규 사장을 초대 사업지원실장, 최윤호 사장을 전략팀장으로 선임"
      },
      {
        "id": 3,
        "title": "seoul.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQECREjsazGWR1TZyM7CH4uEpMWsedIJdg_kfpRMpFv0LEwCUTzskdcOhvddkz2e43ZMK3VXiR4-I2OpjmWgY6IGP4wvoVKu3tRAiUr59grGnAMCgzKopTXdfveUNmQssSGnfdYW_aGqfCQoZAeNDX_gw612Rw==",
        "publisher": "seoul.co.kr",
        "excerpt": "(2026-06) 트렌드포스 집계 기준 2026년 1분기 글로벌 파운드리 시장 점유율은 TSMC가 72.3%(매출 358억 5,500만 달러)로 1위, 삼성전자가 6.5%(매출 32억 100만 달러)로 2위를 기록함"
      },
      {
        "id": 4,
        "title": "jobkorea.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE63Bh6G2u-0jxIKqx9zfBL77bOnGWgY8ocPhJ0jUV9Dp5nAcxvvj7NcjLEQbe7cqGCe3SSPraudV1-Gw-joRgJmbFo642pJzljb_6PwPutB6jFfmB_4BhfuS0_sX0P7BmFFyFhuD9PZfFc7AJOQgp4CPt_Wa5Af5mc2eq__V4AFMq2wwUDQ6ygqW8V7i0JeTvxsX7P5yi-Nhvt_rvo",
        "publisher": "jobkorea.co.kr",
        "excerpt": "(2026-03) 주요 매출처는 Apple, Qualcomm, Best Buy, Deutsche Telekom, Verizon 등으로 구성되며 상위 주요 매출처가 전체 매출의 약 16% 수준을 차지함"
      },
      {
        "id": 5,
        "title": "investchosun.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHGdQ7vM3_q6uw4ggZu-OwTHmla6XoelZnSKdGq5OKYmLRh_Um6aggsoRy1lko1NzOEGB6vDlRFvI2aLRDjhy-437PmDHV1WMpYgPfn4fQCq5gC2wiJ3ZVC9uhQKpagPQqKsF4K6OXVzu-u-0YbSmtiOD9c6wTDF2c6IJO-gh53PNqg",
        "publisher": "investchosun.com",
        "excerpt": "(2025-11) 전사 컨트롤타워 역할을 하던 임시 조직 '사업지원TF'를 8년 만에 상설 조직인 '사업지원실'로 개편하고, 산하에 전략팀·경영진단팀·피플팀 3개 팀 편제 구축 및 박학규 사장을 초대 사업지원실장, 최윤호 사장을 전략팀장으로 선임"
      },
      {
        "id": 6,
        "title": "epnc.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGFA7_ODvHhaM5Ck1V29EC_H0sq8dosk5YksfYt52rW51BG2-AsAk-thkIsUdnFc9aAqMpBLqiOw55cfJtxKTEeuNnc7hF23vjOy7l1H_f0BdDaVRUROfR59GrjbA8atvbDEbqQxLDQ-n2YGWybEbw=",
        "publisher": "epnc.co.kr",
        "excerpt": "(2026-09) 트렌드포스 집계 기준 2026년 2분기 글로벌 파운드리 시장 점유율은 TSMC가 72.5%(매출 약 402억 달러), 삼성전자가 5.9%(매출 약 33억 달러)를 기록함"
      },
      {
        "id": 7,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEq_33KJEhRIP_uHn5HKrNdjPT31BULdX8InB5Hvw9pa4oldrBjnteUAS7jhvLEJJ4MqBl5sKAnVHwWkC4-f2V7s0WTbiWnMNDR3GBkePR3Pkh2pXeadZUJKBvCOXECevBQ-dKornIUh5WleAuFSAWt1ZAoNIE-O1Byy3g05nk=",
        "publisher": "samsung.com",
        "excerpt": "(2026-01) 2025년 연간 연결 순매출액(333.6조 원) 기준 부문별 매출 비중은 DX 부문 52%(188.0조 원), DS 부문 36%(130.1조 원), SDC 부문 8%(29.8조 원), Harman 부문 4%(15.8조 원)로 집계됨"
      },
      {
        "id": 8,
        "title": "etnews.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHfj5NOt8GSnzJjs1vlxA_AF4Q-kHYPz6KsqfVbIN3Ihvspm1IrO3zjw35bGkrXOWczt3ndRCVRQFtGrmA0mWQx5wj7U7ryXeYtVY-GQOar3oD2Kak8rxRTCVw=",
        "publisher": "etnews.com",
        "excerpt": "(2025-11) DX부문 산하 경영지원 조직의 명칭을 '경영지원실'에서 '경영지원담당'으로 격상 변경하여 산하 신사업 발굴 기획 기능 강화"
      },
      {
        "id": 9,
        "title": "tistory.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGTUN0shMM2RY1VEXp4DTaZeZHQI0gVhkgvorUQlhyUloCMgfIuT3-BTqFLACKL6VNRynZqEFxcMQiUnnwl8D1d0n57bWHy_4pt-vGEtZ0k8eZTJ7U=",
        "publisher": "tistory.com",
        "excerpt": "(2026) TSMC는 순수 파운드리(위탁생산) 전문 기업으로 엔비디아·애플 등 외부 빅테크를 주요 고객으로 두는 반면, 삼성전자는 메모리·시스템LSI(설계)·파운드리를 함께 영위하는 종합 반도체(IDM) 구조라는 차이가 있음"
      },
      {
        "id": 10,
        "title": "zdnet.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHVc8aiUT1-I-1nRrdM5eRt9ntSzoWNxPi_hULW8FPXsUZJk3NvD1c57mnu2_8KRxjVwQwHhDNisfy6LvT9LryoV20dEX5vIFg-X-ECd-80_l1R_jzr9n0H-S6DArdn-5c=",
        "publisher": "zdnet.co.kr",
        "excerpt": "(2026-01) 2025년 부문별 연간 영업이익은 AI 서버향 반도체 수요 및 메모리 가격 상승에 힘입어 DS 부문이 24조 9,000억 원, DX 부문이 12조 9,000억 원을 기록해 DS 부문이 전사 이익 성장을 견인함"
      },
      {
        "id": 11,
        "title": "g-enews.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHixyB8Sda-cKkI_odYNCWSiMSX7Pj_VlJmdUmpouv5z7dx0GhGRhWApStSch18tEoOpWeQ1p1vsvJYmc5JtrRQyLYR_ZawJsMnt-kwsXHMHro2uNGJkxfz1aimBsUba5RkA0iPv1woX_FL_QEzPoXfv4aaIetKXG-Old30WkxhMLTWpt0=",
        "publisher": "g-enews.com",
        "excerpt": "(2025-11) DS(반도체)부문 내 D램·낸드·HBM 개발 기능을 총괄 통합하는 '메모리 개발 담당' 조직 및 엔비디아 협업 반도체 AI 팩토리 추진을 위한 '디지털 트윈센터' 신설"
      },
      {
        "id": 12,
        "title": "segye.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFRu9ppT20miQ_PvvSXCeIh0Jzw2OEyyGZGeiI9TP5bvkwm8UObZ2dal1G6_OEU01f7hrXK57EFaw2Ex5NtJGZZGK3VLxNAqr1L0uFt6xTth9RsYzlhbuEdTOqmmU3QKX0OtOU=",
        "publisher": "segye.com",
        "excerpt": "(2026-10) 메모리 반도체 부문에서 삼성전자는 2026년 2분기 고대역폭메모리(HBM) 시장 점유율 33%를 기록하며 선두인 SK하이닉스(50%)를 추격함"
      },
      {
        "id": 13,
        "title": "businesspost.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEsPSTJYkUIDsQoCx1A0mTHj3PE2a9dJSU7sc1HnyQYewbS8LdHPbtn5WeUXiZmiiTSgMxKeXEvtKjnLsE8w7F9pqYb9OONWrVr_Qyk88rcR2RfuUNMk55F-exOPg2mSUs-jziNuQhyBR0__u2rxVAGnGlGaria",
        "publisher": "businesspost.co.kr",
        "excerpt": "(2026-03) 부문별 주요 경쟁사는 메모리 반도체 분야의 SK하이닉스·마이크론, 파운드리 분야의 대만 TSMC, 스마트폰 분야의 애플 등이 포진함"
      },
      {
        "id": 14,
        "title": "fnnews.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEnigTCjGEUZ_BJuKT_FoLr9vZoNMwmhb9-1Q93dGObWkzBMLUF2tWcQwWdhl_QqEa2ab1dE9ilYCsFsEGPQ5GAJG4mjvtil3Dro-H37qD7uT4eTQWoHyQo5fzWYN8-ri9RKDk=",
        "publisher": "fnnews.com",
        "excerpt": "(2025-11) DX부문 내 영상디스플레이(VD)·생활가전(DA)·모바일(MX) 등 주요 사업부 산하에 AI 역량 실행 조직인 'AX팀' 신설"
      },
      {
        "id": 15,
        "title": "ifm.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEj7bEITysvIWO1LtgvPEaJkr_tTnpvim8rSHoI0A2Oq7F-PyPyStN-V5pnlSOww9nLlfXNUGuSDUQGDuDrwdKvF5XnCvEHO_sKGd3ZNpD0_sVTzkV-qVFC0mcgGDFYv6tS3dX90vLNHl8jIKQ=",
        "publisher": "ifm.kr",
        "excerpt": "(2026-10) 카운터포인트리서치 기준 2026년 2분기 글로벌 스마트폰 시장 출하량 점유율은 삼성전자가 24%로 1위, 애플이 20%로 2위이나, 매출 점유율은 애플이 49%, 삼성전자가 16%를 기록함"
      },
      {
        "id": 16,
        "title": "vizensoft.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGhVxa_f-5B7Asj-Uwl0AgnapNcRiNENwmfjXeBpt_J1oUp7WdIGYuWYQk-lLe4e4-PxXgrSdYyrKdf9zzOX8y7vDSFKQq96HrXKT9Ya-d8vfJoKlskELvHECPvmmpaoYdn1IRlKuQp",
        "publisher": "vizensoft.com",
        "excerpt": "(2024-11) 전사 조직개편을 통해 사업지원TF를 사업지원실로 격상하고 산하에 M&A팀을 공식 신설해 전장·로봇·AI·반도체 분야 전략적 지분 투자 및 인수 검토 체계를 정비함"
      },
      {
        "id": 17,
        "title": "newswatch.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHs2-TLk5Rn44XsbhXzN3iMtUxyWn0Dpq1CpVDVtyLBWmSTNAAyRkh15N7ZbxZOnXNfozPiHx6qOrwsCxx4U-6DUpYiDtb5NeG_98ydGc5y1MTZkhCB7gcceM9GdKPUctmxYTzkokjYXYwECf4vo0Y=",
        "publisher": "newswatch.kr",
        "excerpt": "(2025-11) 독일 공조설비 전문업체 플랙트그룹(FläktGroup) 인수 절차 완료 공식 발표 및 데이터센터 공조 시장 진출"
      },
      {
        "id": 18,
        "title": "hankyung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHjkfirrwi7ddP2x3HlPo79zA4_NZ9yidC_TGSg_vBpw8gnn1RSkLWxhkRtVHXYrK2edFehLDVugbmwQuaQnHzuAk5Ju_eC-yJoPeF-BdwS3Xqn15taUXwK4NqP-DRHyRVKzk-U",
        "publisher": "hankyung.com",
        "excerpt": "(2026) 스마트폰 시장에서 애플은 독자 OS(iOS) 생태계 기반의 고가 프리미엄 단일 라인업에 집중하는 반면, 삼성전자는 안드로이드 OS 기반의 갤럭시 S·폴더블(프리미엄)부터 A시리즈(중저가)까지 전 가격대 포트폴리오를 운영함"
      },
      {
        "id": 19,
        "title": "newsfreezone.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEbad-RucTCPd1ijAmtJC9GC8f3-Zb-oCMEdaBO46lHNZB-A-QzgTFshLohgchZl2DboQY3K44JNumttaNOSK5XcBBYtTJYSGUBNGYksSDtbF3qkD6Lph9YqwHFWspn2ZZbGfxyAUMoP-k9RQNqkhNvAm-q4vPn",
        "publisher": "newsfreezone.co.kr",
        "excerpt": "(2024-12) 로봇 제조업체 레인보우로보틱스에 대한 콜옵션을 행사해 지분율을 35.0%로 확대하며 최대주주로 올라서고 연결 종속회사로 편입함"
      },
      {
        "id": 20,
        "title": "einfomax.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGFGJDODOL2vLTj564hy-PMDtQq2YejjCIN8F4QER7grwM5nS0DOdPiwP4Q9rD52NZq-HpLIDrsc8x-HIu-mFQ1sB8nSYcC0bVg6Ms-OrIkKrVoroQ-ua5zME2vIyMiGWZncy2GG_Uf2VLOZMTZGkmB2l6hig==",
        "publisher": "einfomax.co.kr",
        "excerpt": "(2025-12) 본사 경영진 및 글로벌 주요 법인장 300여 명이 참석하여 부문별 업황 및 중장기 신성장 동력을 논의하는 '하반기 글로벌 전략협의회' 개최"
      }
    ],
    "reportMeta": {
      "kind": "COMPANY",
      "schemaVersion": 1,
      "asOf": "2026-10-12",
      "searchQueries": [
        "\"삼성전자\" 투자 조직 신설 인수 2024 2025 2026",
        "삼성전자 부문별 매출 비중 DS DX SDC 하만",
        "삼성전자 사업부문 주력 제품 비중 사업보고서",
        "\"삼성전자\" HBM 파운드리 미래사업기획단 로봇 전장 M&A 발표 2025 2026",
        "삼성전자 사업보고서 매출 영업이익 2024 2025 2026",
        "삼성전자 주가 시가총액 2026년 10월 공시 IR",
        "\"dart.fss.or.kr\" 삼성전자 기업개요 url",
        "삼성전자 HBM4 양산 발표 2025 2026",
        "삼성전자 DX부문 DS부문 기획팀 전략팀 조직개편 2024 2025",
        "site:dart.fss.or.kr \"005930\" OR \"삼성전자\" 회사별 검색",
        "\"삼성전자\" \"인재제일\" \"최고지향\" \"변화선도\" \"정도경영\" \"상생추구\"",
        "삼성전자 전략기획 조직 사업지원TF 경영전략 조직개편",
        "\"삼성전자\" 인재상 OR 핵심가치 site:samsung.com",
        "\"samsung.com/global/ir\"",
        "\"창립 56주년\" 삼성전자 2025",
        "삼성전자 TSMC 파운드리 점유율 2025 2026",
        "삼성전자 경쟁사 SK하이닉스 TSMC 애플 점유율",
        "삼성전자 신년사 2026"
      ],
      "searchEntryPointHtml": "<style>\n.container {\n  align-items: center;\n  border-radius: 8px;\n  display: flex;\n  font-family: Google Sans, Roboto, sans-serif;\n  font-size: 14px;\n  line-height: 20px;\n  padding: 8px 12px;\n}\n.chip {\n  display: inline-block;\n  border: solid 1px;\n  border-radius: 16px;\n  min-width: 14px;\n  padding: 5px 16px;\n  text-align: center;\n  user-select: none;\n  margin: 0 8px;\n  -webkit-tap-highlight-color: transparent;\n}\n.carousel {\n  overflow: auto;\n  scrollbar-width: none;\n  white-space: nowrap;\n  margin-right: -12px;\n}\n.headline {\n  display: flex;\n  margin-right: 4px;\n}\n.gradient-container {\n  position: relative;\n}\n.gradient {\n  position: absolute;\n  transform: translate(3px, -9px);\n  height: 36px;\n  width: 9px;\n}\n@media (prefers-color-scheme: light) {\n  .container {\n    background-color: #fafafa;\n    box-shadow: 0 0 0 1px #0000000f;\n  }\n  .headline-label {\n    color: #1f1f1f;\n  }\n  .chip {\n    background-color: #ffffff;\n    border-color: #d2d2d2;\n    color: #5e5e5e;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #f2f2f2;\n  }\n  .chip:focus {\n    background-color: #f2f2f2;\n  }\n  .chip:active {\n    background-color: #d8d8d8;\n    border-color: #b6b6b6;\n  }\n  .logo-dark {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #fafafa 15%, #fafafa00 100%);\n  }\n}\n@media (prefers-color-scheme: dark) {\n  .container {\n    background-color: #1f1f1f;\n    box-shadow: 0 0 0 1px #ffffff26;\n  }\n  .headline-label {\n    color: #fff;\n  }\n  .chip {\n    background-color: #2c2c2c;\n    border-color: #3c4043;\n    color: #fff;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #353536;\n  }\n  .chip:focus {\n    background-color: #353536;\n  }\n  .chip:active {\n    background-color: #464849;\n    border-color: #53575b;\n  }\n  .logo-light {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #1f1f1f 15%, #1f1f1f00 100%);\n  }\n}\n</style>\n<div class=\"container\">\n  <div class=\"headline\">\n    <svg class=\"logo-light\" width=\"18\" height=\"18\" viewBox=\"9 9 35 35\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M42.8622 27.0064C42.8622 25.7839 42.7525 24.6084 42.5487 23.4799H26.3109V30.1568H35.5897C35.1821 32.3041 33.9596 34.1222 32.1258 35.3448V39.6864H37.7213C40.9814 36.677 42.8622 32.2571 42.8622 27.0064V27.0064Z\" fill=\"#4285F4\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 43.8555C30.9659 43.8555 34.8687 42.3195 37.7213 39.6863L32.1258 35.3447C30.5898 36.3792 28.6306 37.0061 26.3109 37.0061C21.8282 37.0061 18.0195 33.9811 16.6559 29.906H10.9194V34.3573C13.7563 39.9841 19.5712 43.8555 26.3109 43.8555V43.8555Z\" fill=\"#34A853\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M16.6559 29.8904C16.3111 28.8559 16.1074 27.7588 16.1074 26.6146C16.1074 25.4704 16.3111 24.3733 16.6559 23.3388V18.8875H10.9194C9.74388 21.2072 9.06992 23.8247 9.06992 26.6146C9.06992 29.4045 9.74388 32.022 10.9194 34.3417L15.3864 30.8621L16.6559 29.8904V29.8904Z\" fill=\"#FBBC05\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 16.2386C28.85 16.2386 31.107 17.1164 32.9095 18.8091L37.8466 13.8719C34.853 11.082 30.9659 9.3736 26.3109 9.3736C19.5712 9.3736 13.7563 13.245 10.9194 18.8875L16.6559 23.3388C18.0195 19.2636 21.8282 16.2386 26.3109 16.2386V16.2386Z\" fill=\"#EA4335\"/>\n    </svg>\n    <svg class=\"logo-dark\" width=\"18\" height=\"18\" viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\">\n      <circle cx=\"24\" cy=\"23\" fill=\"#FFF\" r=\"22\"/>\n      <path d=\"M33.76 34.26c2.75-2.56 4.49-6.37 4.49-11.26 0-.89-.08-1.84-.29-3H24.01v5.99h8.03c-.4 2.02-1.5 3.56-3.07 4.56v.75l3.91 2.97h.88z\" fill=\"#4285F4\"/>\n      <path d=\"M15.58 25.77A8.845 8.845 0 0 0 24 31.86c1.92 0 3.62-.46 4.97-1.31l4.79 3.71C31.14 36.7 27.65 38 24 38c-5.93 0-11.01-3.4-13.45-8.36l.17-1.01 4.06-2.85h.8z\" fill=\"#34A853\"/>\n      <path d=\"M15.59 20.21a8.864 8.864 0 0 0 0 5.58l-5.03 3.86c-.98-2-1.53-4.25-1.53-6.64 0-2.39.55-4.64 1.53-6.64l1-.22 3.81 2.98.22 1.08z\" fill=\"#FBBC05\"/>\n      <path d=\"M24 14.14c2.11 0 4.02.75 5.52 1.98l4.36-4.36C31.22 9.43 27.81 8 24 8c-5.93 0-11.01 3.4-13.45 8.36l5.03 3.85A8.86 8.86 0 0 1 24 14.14z\" fill=\"#EA4335\"/>\n    </svg>\n    <div class=\"gradient-container\"><div class=\"gradient\"></div></div>\n  </div>\n  <div class=\"carousel\">\n<a class=\"chip\" href=\"https://www.google.com/search?q=%22%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90%22+%ED%88%AC%EC%9E%90+%EC%A1%B0%EC%A7%81+%EC%8B%A0%EC%84%A4+%EC%9D%B8%EC%88%98+2024+2025+2026&client=app-vertex-grounding&safesearch=active\">&quot;삼성전자&quot; 투자 조직 신설 인수 2024 2025 2026</a>\n<a class=\"chip\" href=\"https://www.google.com/search?q=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90+%EB%B6%80%EB%AC%B8%EB%B3%84+%EB%A7%A4%EC%B6%9C+%EB%B9%84%EC%A4%91+DS+DX+SDC+%ED%95%98%EB%A7%8C&client=app-vertex-grounding&safesearch=active\">삼성전자 부문별 매출 비중 DS DX SDC 하만</a>\n<a class=\"chip\" href=\"https://www.google.com/search?q=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90+%EC%82%AC%EC%97%85%EB%B6%80%EB%AC%B8+%EC%A3%BC%EB%A0%A5+%EC%A0%9C%ED%92%88+%EB%B9%84%EC%A4%91+%EC%82%AC%EC%97%85%EB%B3%B4%EA%B3%A0%EC%84%9C&client=app-vertex-grounding&safesearch=active\">삼성전자 사업부문 주력 제품 비중 사업보고서</a>\n<a class=\"chip\" href=\"https://www.google.com/search?q=%22%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90%22+HBM+%ED%8C%8C%EC%9A%B4%EB%93%9C%EB%A6%AC+%EB%AF%B8%EB%9E%98%EC%82%AC%EC%97%85%EA%B8%B0%ED%9A%8D%EB%8B%A8+%EB%A1%9C%EB%B4%87+%EC%A0%84%EC%9E%A5+M%26A+%EB%B0%9C%ED%91%9C+2025+2026&client=app-vertex-grounding&safesearch=active\">&quot;삼성전자&quot; HBM 파운드리 미래사업기획단 로봇 전장 M&amp;A 발표 2025 2026</a>\n<a class=\"chip\" href=\"https://www.google.com/search?q=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90+%EC%82%AC%EC%97%85%EB%B3%B4%EA%B3%A0%EC%84%9C+%EB%A7%A4%EC%B6%9C+%EC%98%81%EC%97%85%EC%9D%B4%EC%9D%B5+2024+2025+2026&client=app-vertex-grounding&safesearch=active\">삼성전자 사업보고서 매출 영업이익 2024 2025 2026</a>\n<a class=\"chip\" href=\"https://www.google.com/search?q=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90+%EC%A3%BC%EA%B0%80+%EC%8B%9C%EA%B0%80%EC%B4%9D%EC%95%A1+2026%EB%85%84+10%EC%9B%94+%EA%B3%B5%EC%8B%9C+IR&client=app-vertex-grounding&safesearch=active\">삼성전자 주가 시가총액 2026년 10월 공시 IR</a>\n  </div>\n</div>",
      "linkedResumeAnalysisId": null,
      "repaired": false
    }
  },
};
