import type { CompanyReportData } from "@/types/companyReport";
import { COMPANY_REPORT_SAMPLE_COMPANY, COMPANY_REPORT_SAMPLE_JOB_ROLE } from "./companyReportSampleMeta";

/**
 * 공개 샘플 리포트(/company-report?sample=1, 랜딩 소개 섹션).
 * scripts/manual/company-analysis-probe.mjs --out 으로 생성한 실제 리포트를 사용자가 검수해 굳힌 것이다.
 * 갱신: node --env-file=.env scripts/manual/company-analysis-probe.mjs "<회사>" "<직무>" --out sample.json
 *       → result 에서 analysisMeta 를 뺀 나머지를 report 에 붙여 넣는다(searchEntryPointHtml 포함 — 검색 그라운딩 약관).
 *       서버가 반환 전에 거는 tidyCompanyReport 가 프로브 결과에도 이미 적용돼 있다(현재 샘플은 2단 병렬 파이프라인, 2026-09-08).
 *       출처 excerpt 는 groundingSupports 에서 온다. 현재 샘플은 머리표 정리·그룹 번갈아 병합이 들어가기 직전 실행이라
 *       머리표만 같은 규칙으로 정리했고, 출처 20건 중 직무 그룹 출처가 4건뿐이다(지금 서버는 두 그룹을 번갈아 채운다).
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
      "oneLiner": "반도체와 AI 기반 스마트 기기로 글로벌 시장을 선도하는 기업",
      "keywords": [
        "반도체",
        "AI",
        "HBM",
        "파운드리",
        "스마트폰",
        "가전"
      ],
      "asOf": "2026-09-08",
      "positionInIndustry": "삼성전자는 DS(반도체)와 DX(완제품) 부문을 양대 축으로 글로벌 IT 산업을 선도하고 있습니다. 특히 메모리 반도체 시장에서 독보적인 위치를 차지하며, 파운드리 분야에서는 TSMC와 경쟁하고 스마트폰 시장에서는 애플 및 중국 업체들과 치열하게 경합하고 있습니다."
    },
    "businessMap": {
      "summary": "삼성전자는 반도체 사업을 총괄하는 DS 부문과 스마트폰, 가전 등 완제품을 담당하는 DX 부문을 중심으로 수익을 창출합니다. 여기에 삼성디스플레이의 OLED 패널과 하만의 디지털 콕핏 및 카오디오 사업이 주요 축을 이룹니다.",
      "segments": [
        {
          "name": "DS (Device Solutions) 부문",
          "whatItDoes": "DRAM, NAND Flash, HBM 등 메모리 반도체와 모바일 AP, 카메라 센서칩, 파운드리(위탁생산), 시스템LSI 등 비메모리 반도체를 설계, 생산하여 글로벌 빅테크 기업에 공급합니다.",
          "weight": "2025년 매출액 기준 약 39%를 차지했으나, 2025년 영업이익의 중심이었으며 2026년에는 전체 이익의 82%를 벌 것으로 예상됩니다.",
          "phase": "성장",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "DX (Device eXperience) 부문",
          "whatItDoes": "TV, 모니터, 생활가전(냉장고, 에어컨), 스마트폰(갤럭시 S, Z 폴드 시리즈), 네트워크 시스템, PC 등 소비자 접점의 완제품을 개발하고 판매합니다.",
          "weight": "2025년 매출액이 DS 부문과 거의 같았으며, 매출의 절반 이상을 차지하지만 영업이익률은 약 3% 수준입니다.",
          "phase": "성숙",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "삼성디스플레이 (SDC)",
          "whatItDoes": "OLED 패널을 개발 및 생산하여 스마트폰, TV 등 다양한 전자기기에 공급합니다.",
          "weight": "주요 사업 축 중 하나로, 자체적인 사업 영역을 구축하고 있습니다.",
          "phase": "성장",
          "sourceIds": [
            1
          ]
        },
        {
          "name": "하만 (Harman)",
          "whatItDoes": "디지털 콕핏 및 카오디오 시스템을 개발하여 전장 사업 분야에서 핵심적인 역할을 수행합니다.",
          "weight": "주요 사업 축 중 하나로, 전장 사업의 성장을 견인하고 있습니다.",
          "phase": "성장",
          "sourceIds": [
            1
          ]
        }
      ],
      "customersAndCompetitors": "DS 부문의 주요 고객은 구글, AMD와 같은 글로벌 빅테크 기업이며, 파운드리 분야에서는 TSMC, 메모리 분야에서는 SK하이닉스, 마이크론과 경쟁합니다. DX 부문은 일반 소비자를 비롯해 애플, 퀄컴 등 다양한 기업을 고객으로 두며, 스마트폰 시장에서 애플 및 중국 업체들과 경쟁하고 있습니다."
    },
    "focusBusinesses": {
      "statedDirection": "삼성전자는 반도체와 가전·모바일 전 사업 영역에 걸쳐 '인공지능(AI) 중심 전략'을 공식화했습니다. **AI를 혁신과 성장의 핵심 동력으로 삼아 프리미엄 제품의 부가가치를 높이는 데 주력하고 있습니다.**",
      "items": [
        {
          "name": "AI 중심 전략 및 제품 확대",
          "whatChanged": "반도체 설계, 연구개발, 제조, 품질 등 전 생산 영역에 AI 기술을 적용하고, 스마트폰과 가전 전반에 AI 기능을 확대하는 전략을 추진하고 있습니다.",
          "evidence": "2024년 5월 세계 최초 'AI폰' 갤럭시 S24 시리즈를 출시했으며, 비스포크 AI TV를 비롯한 AI 냉장고, 청소기 등 AI 관련 신제품을 동시다발적으로 선보였습니다.",
          "whyNow": "AI 기술이 IT 산업 전반의 핵심 경쟁력으로 부상하면서, 제품 차별화와 미래 성장 동력 확보를 위해 AI 역량 강화가 필수적입니다.",
          "relevanceToRole": "직접. 전사적인 AI 전략 수립과 사업부별 실행 계획 조율에 전략기획 직무가 핵심적인 역할을 수행합니다.",
          "sourceIds": [
            2
          ]
        },
        {
          "name": "고부가가치 HBM 및 파운드리 사업 강화",
          "whatChanged": "HBM3E 12단 등 고부가가치 HBM 판매를 확대하고, AI 서버 수요 증가에 맞춰 서버용 고부가 제품 비중을 높여 마진을 개선하고 있습니다. 파운드리 사업부는 2나노 1세대 양산과 HBM4 베이스다이 생산을 확대하고 있습니다.",
          "evidence": "2025년 7월 테슬라와 23조 원 규모의 파운드리 대형 수주 계약을 체결했으며, 2026년 1분기 파운드리 가동률이 80%대까지 상승했습니다.",
          "whyNow": "AI 시대를 맞아 고성능 반도체 수요가 폭발적으로 증가하면서, HBM과 첨단 파운드리는 반도체 사업의 핵심 성장 동력으로 자리매김하고 있습니다.",
          "relevanceToRole": "직접. 고부가가치 반도체 사업의 시장 분석, 투자 전략 수립, 고객사 확보 방안 마련 등에서 전략기획 직무의 역할이 중요합니다.",
          "sourceIds": [
            2
          ]
        },
        {
          "name": "시스템LSI (모바일 AP) 경쟁력 강화",
          "whatChanged": "자체 개발 모바일 AP인 엑시노스의 플래그십 스마트폰 탑재를 확대하며 시스템LSI 사업의 매출 기여를 시작했습니다.",
          "evidence": "2026년 2월 엑시노스 2600이 갤럭시 S26에 탑재되면서 시스템LSI 사업부의 매출 기여가 본격화되었습니다.",
          "whyNow": "모바일 AP는 스마트폰의 성능과 AI 기능을 좌우하는 핵심 부품으로, 자체 AP 경쟁력 강화는 DX 부문의 제품 차별화와 DS 부문의 성장 동력 확보에 기여합니다.",
          "relevanceToRole": "간접. 시스템LSI 사업의 중장기 전략 수립, 시장 포지셔닝 분석, DX 부문과의 협력 방안 모색 등에서 전략기획 직무가 관여할 수 있습니다.",
          "sourceIds": [
            2
          ]
        }
      ],
      "translatedTalentKeywords": []
    },
    "financialSnapshot": {
      "listed": true,
      "market": "유가증권시장 · 삼성전자",
      "revenueTrend": "삼성전자의 연결 기준 연간 매출은 2025년 333조 6,059억 원으로 전년 대비 10.9% 증가하며 역대 최대 기록을 달성했습니다. 이는 HBM 고부가 제품 판매 확대와 메모리 가격 상승, 그리고 AI 가전 및 스마트폰 판매 호조에 힘입은 결과입니다.",
      "profitTrend": "연결 기준 연간 영업이익은 2025년 43조 6,011억 원으로 전년 대비 33.2% 증가하며 역대 4위를 기록했습니다. 최근 전체 영업이익은 2023년 6.6조 원에서 2025년 43.6조 원으로 크게 회복되었으며, 이는 DS 부문의 실적 개선 영향이 컸습니다. DX 부문은 매출의 절반 이상을 차지하지만 영업이익은 DS 부문에 비해 낮은 수준입니다.",
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
          "label": "순이익",
          "value": "45조 2,068억 원",
          "period": "2025년 연간",
          "sourceIds": [
            3
          ]
        },
        {
          "label": "연구개발비",
          "value": "37조 7,000억 원",
          "period": "2025년 연간",
          "sourceIds": [
            3
          ]
        }
      ],
      "marketView": "2026년 9월 8일 기준 삼성전자의 전일 종가는 250,500원입니다. 시장은 반도체 업황 회복과 AI 관련 신사업 성과에 주목하며 주가 흐름에 영향을 미치고 있습니다.",
      "recentDisclosures": [],
      "fundingNote": "",
      "forApplicant": "회사의 역대 최대 매출과 큰 폭의 영업이익 증가는 신사업 투자 여력 확대를 의미하며, 특히 DS 부문의 높은 이익 기여는 반도체 분야의 지속적인 성장이 예상됨을 보여줍니다. **이는 전략기획 직무가 새로운 성장 동력을 발굴하고 대규모 투자 계획을 수립하는 데 중요한 역할을 할 기회가 많다는 신호입니다.**"
    },
    "currentIssues": [
      {
        "title": "DS 부문 조직 개편 및 디지털 트윈센터 신설",
        "when": "2025-11",
        "fact": "삼성전자는 2025년 11월 반도체 사업 조직을 개편하여 메모리 개발을 총괄하는 '메모리 개발 담당'을 신설하고, 글로벌 제조인프라 총괄 산하에 '디지털 트윈센터'를 신설했습니다.",
        "whyItMatters": "이는 차세대 메모리 기술 개발 속도를 높이고, 반도체 제조 공정의 효율성과 생산성을 극대화하여 초격차 기술 리더십을 유지하려는 전략적 움직임입니다.",
        "forApplicant": "전략기획 직무는 이러한 조직 변화의 배경을 이해하고, 신설 조직의 목표 달성을 위한 전략 수립 및 실행 지원에 기여할 수 있습니다.",
        "sourceIds": [
          4
        ]
      },
      {
        "title": "SAIT 조직 개편 및 AI 기술 대응 강화",
        "when": "2025-11",
        "fact": "차세대 반도체 기술을 연구하는 SAIT(옛 삼성종합기술원)는 2025년 11월 AI 기술 변화에 빠르게 대응하기 위해 기존 '센터' 중심 조직을 더 작은 단위의 '플랫폼' 체제로 개편했습니다.",
        "whyItMatters": "이 개편은 급변하는 AI 기술 환경 속에서 연구 개발의 민첩성을 높이고, 핵심 기술 선점을 통해 미래 경쟁력을 확보하려는 삼성전자의 노력을 보여줍니다.",
        "forApplicant": "전략기획 직무는 SAIT의 연구 방향과 연계하여 장기적인 기술 로드맵을 수립하고, AI 기술 투자 전략을 지원하는 역할을 맡을 수 있습니다.",
        "sourceIds": [
          4
        ]
      },
      {
        "title": "대규모 국내 투자 및 반도체 클러스터 구축",
        "when": "2026-09",
        "fact": "삼성전자는 2026년 9월 국내에 대규모 투자를 진행하여 반도체 클러스터 구축에 집중하고, AI 반도체, 로봇, 배터리, IT 부품 및 소재 분야에도 투자를 이어갈 계획을 발표했습니다.",
        "whyItMatters": "이 투자는 국내 반도체 생태계를 강화하고, 미래 핵심 기술 분야에서 글로벌 리더십을 확고히 하려는 국가적, 기업적 차원의 중요한 전략입니다.",
        "forApplicant": "전략기획 직무는 이러한 대규모 투자 계획의 타당성을 분석하고, 투자 효과를 극대화하기 위한 전략적 방향을 제시하는 데 참여할 수 있습니다.",
        "sourceIds": [
          5
        ]
      }
    ],
    "roleInContext": {
      "whereItSits": "전략기획 직무는 전사 차원의 미래 성장 동력 발굴과 사업 포트폴리오 최적화를 담당하는 미래사업기획단이나, 각 사업부문(DS, DX) 직속의 경영전략담당 또는 사업지원실 전략팀에 배치될 가능성이 높습니다. **회사의 중장기 비전 달성을 위한 핵심적인 의사결정 과정을 지원하는 역할을 수행합니다.**",
      "problemsItSolves": [
        "글로벌 IT 시장 및 경쟁사 동향을 분석하여 신규 사업 기회를 탐색하고 보고서를 작성합니다.",
        "기존 사업의 성장 전략을 검토하고, 사업부별 중장기 목표 달성을 위한 실행 계획을 수립하는 데 기여합니다.",
        "회사의 투자 우선순위를 설정하고, 대규모 투자 프로젝트의 경제적 타당성을 분석하는 자료를 준비합니다.",
        "사업부 간 시너지를 창출하고, 전사적인 자원 배분 효율성을 높이기 위한 전략을 검토하고 제안합니다."
      ],
      "whyHiringNow": "현재 삼성전자는 AI 시대를 맞아 전 사업 영역에서 대대적인 변화와 투자를 추진하고 있습니다. 이러한 변화의 시기에 전략기획 직무를 채용하는 것은, 가설이지만, **미래 성장 동력을 발굴하고 사업 포트폴리오를 재편하는 과정에서 젊고 유능한 인재의 전략적 사고와 분석 역량이 절실하기 때문으로 보입니다.**",
      "recentNewsForRole": [
        {
          "title": "삼성전자, 'CUBE' 전략 공개로 차세대 메모리 시장 선점",
          "when": "2026-09",
          "fact": "삼성전자는 '세미콘 타이완 2026'에서 차세대 메모리 반도체 시장 선점을 위한 'CUBE' 전략(Capacity, Utilization, Bandwidth, Efficiency)을 공개했습니다.",
          "whyForRole": "이 전략은 메모리 반도체 사업의 미래 방향성을 제시하며, 전략기획 직무는 CUBE 전략의 각 요소가 시장에서 어떤 의미를 가지며, 이를 통해 어떻게 경쟁 우위를 확보할지 분석하고 구체적인 실행 방안을 모색하는 데 기여할 수 있습니다. 자소서나 면접에서 이 전략을 언급하며 삼성전자의 메모리 사업에 대한 이해도를 보여줄 수 있습니다.",
          "sourceIds": [
            5
          ]
        },
        {
          "title": "DX 부문, 협력회사와 AI 시대 상생협력 강조",
          "when": "2026-03",
          "fact": "삼성전자 DX부문은 협력회사와 '2026년 상생협력 DAY'를 개최하고, AI 시대에 원팀 파트너십을 통한 혁신과 스마트 팩토리 전환을 강조했습니다.",
          "whyForRole": "이 소식은 DX 부문이 AI 전환 과정에서 협력사와의 관계를 중요하게 생각하며, 공급망 전체의 혁신을 추구하고 있음을 보여줍니다. 전략기획 직무는 DX 부문의 AI 전략이 협력 생태계에 미치는 영향을 분석하고, 상생을 통한 사업 경쟁력 강화 방안을 모색하는 데 필요한 관점을 제시할 수 있습니다.",
          "sourceIds": [
            5
          ]
        }
      ],
      "postingReading": ""
    },
    "opportunitiesAndRisks": {
      "opportunities": [
        {
          "headline": "AI 시대 선도적 위치 확보",
          "text": "삼성전자는 AI폰, AI 가전, AI 반도체 등 전방위적인 AI 전략을 통해 시장을 선도하고 있습니다. **특히 DS 부문의 HBM과 파운드리 기술력은 AI 시대 핵심 인프라로서 독보적인 성장 기회를 제공합니다.** AI 기술 리더십을 바탕으로 새로운 고부가가치 시장을 창출할 수 있습니다.",
          "sourceIds": []
        },
        {
          "headline": "견고한 사업 포트폴리오",
          "text": "메모리 반도체, 시스템LSI, 파운드리 등 DS 부문의 강력한 기술력과 스마트폰, TV, 가전 등 DX 부문의 광범위한 소비자 접점을 동시에 보유하고 있습니다. **이러한 다각화된 사업 포트폴리오는 특정 시장의 변동성에 대한 회사의 안정성을 높이고, 사업 간 시너지를 창출할 잠재력이 큽니다.**",
          "sourceIds": []
        },
        {
          "headline": "대규모 투자 및 R&D 역량",
          "text": "삼성전자는 매년 막대한 규모의 연구개발비와 시설투자를 집행하며 기술 초격차를 유지하고 있습니다. **특히 국내 반도체 클러스터 구축과 AI, 로봇 등 미래 기술 분야에 대한 지속적인 투자는 장기적인 성장 동력을 확보하는 데 중요한 기반이 됩니다.**",
          "sourceIds": []
        }
      ],
      "risks": [
        {
          "headline": "글로벌 경기 변동성 심화",
          "text": "반도체 및 IT 제품 시장은 글로벌 경기 변동에 매우 민감하게 반응합니다. **경기 침체나 소비 심리 위축은 DS 및 DX 부문의 실적에 직접적인 영향을 미 미칠 수 있어, 이에 대한 선제적인 대응 전략이 필요합니다.**",
          "sourceIds": []
        },
        {
          "headline": "경쟁 심화 및 기술 격차 유지",
          "text": "메모리 반도체는 SK하이닉스, 마이크론 등과의 경쟁이 치열하며, 파운드리는 TSMC와의 격차를 줄여야 하는 과제가 있습니다. 스마트폰 시장에서는 애플과 중국 업체들의 추격이 거셉니다. **지속적인 기술 혁신과 차별화된 제품 출시를 통해 경쟁 우위를 유지하는 것이 중요합니다.**",
          "sourceIds": []
        },
        {
          "headline": "지정학적 리스크 및 공급망 불안정",
          "text": "미중 기술 패권 경쟁과 같은 지정학적 리스크는 반도체 공급망에 큰 영향을 미칠 수 있습니다. **특정 국가에 대한 의존도를 낮추고, 안정적인 생산 및 공급망을 구축하는 것이 회사가 풀어야 할 중요한 숙제입니다.**",
          "sourceIds": []
        }
      ]
    },
    "businessCandidates": [
      {
        "name": "AI 반도체 (HBM 및 파운드리)",
        "whyForThisRole": "AI 반도체는 삼성전자 DS 부문의 핵심 성장 동력이며, 이 시장의 급격한 성장은 전사 전략의 최우선 순위입니다. 전략기획 직무는 이 분야의 시장을 분석하고, 투자 및 고객사 확보 전략을 수립하는 데 직접적으로 기여할 수 있습니다.",
        "angle": "AI 시대에 HBM과 첨단 파운드리가 왜 필수적인 인프라인지, 그리고 삼성전자가 이 시장에서 어떻게 초격차를 유지하고 확장할 수 있을지 고객사 및 경쟁사 관점에서 깊이 있게 분석하는 각도",
        "experienceToPrepare": "반도체 산업 관련 수업 프로젝트, 시장 분석 공모전 참여, 기술 트렌드 분석 리포트 작성 경험",
        "seedSentence": "AI 반도체 시장의 성장 요인을 분석하고, 삼성전자의 HBM 및 파운드리 사업이 글로벌 AI 생태계에서 어떤 역할을 할 수 있을지"
      },
      {
        "name": "AI 스마트폰 및 가전",
        "whyForThisRole": "DX 부문의 AI 스마트폰과 가전은 일반 소비자와의 접점을 확대하고, 삼성전자의 AI 기술력을 체감하게 하는 핵심 제품입니다. 전략기획 직무는 이 제품들이 시장에서 어떤 가치를 창출하고, 어떻게 소비자 경험을 혁신할지 고민하는 데 참여할 수 있습니다.",
        "angle": "갤럭시 S24와 비스포크 AI 가전이 소비자 라이프스타일에 어떤 변화를 가져오고 있는지, 그리고 삼성전자가 AI를 통해 스마트 기기 시장에서 어떻게 차별화된 리더십을 구축할 수 있을지 사용자 경험 관점에서 접근하는 각도",
        "experienceToPrepare": "스마트폰 또는 가전 제품 사용성 개선 프로젝트, 소비자 트렌드 분석 보고서 작성, 마케팅 전략 기획 인턴 경험",
        "seedSentence": "AI 스마트폰과 가전이 만들어낼 새로운 소비자 경험을 정의하고, 이를 통해 삼성전자가 DX 부문의 수익성을 어떻게 개선할 수 있을지"
      },
      {
        "name": "디지털 트윈 기반 제조 혁신",
        "whyForThisRole": "DS 부문 내 '디지털 트윈센터' 신설은 반도체 제조 공정의 효율성과 생산성을 극대화하려는 중요한 전략적 움직임입니다. 전략기획 직무는 이러한 제조 혁신이 전사적인 사업 목표 달성에 어떻게 기여할지 분석하고, 관련 투자 및 기술 도입 전략을 지원할 수 있습니다.",
        "angle": "디지털 트윈 기술이 반도체 생산 수율과 개발 속도를 어떻게 향상시키고 있는지, 그리고 이를 통해 삼성전자가 글로벌 제조 경쟁력을 어떻게 강화할 수 있을지 공정 효율화 관점에서 바라보는 각도",
        "experienceToPrepare": "제조 공정 개선 관련 수업 프로젝트, 데이터 분석을 통한 문제 해결 경험, 생산 관리 또는 공급망 관련 인턴 경험",
        "seedSentence": "디지털 트윈 기술이 반도체 제조 공정의 미래를 어떻게 변화시키고, 삼성전자의 생산성 향상에 어떤 영향을 미칠지"
      }
    ],
    "interviewPrep": {
      "questions": [
        {
          "question": "삼성전자가 전 사업 영역에 걸쳐 'AI 중심 전략'을 공식화한 배경과, 이 전략이 DS 및 DX 부문에 각각 어떤 영향을 미칠 것이라고 생각하나요?",
          "direction": "AI 기술이 IT 산업 전반의 핵심 동력으로 부상하고 있음을 언급하고, DS 부문에서는 반도체 설계 및 제조 효율성 증대, DX 부문에서는 제품 차별화와 사용자 경험 혁신 측면에서 영향을 분석하여 답변합니다."
        },
        {
          "question": "최근 삼성전자가 고부가가치 HBM 판매를 확대하고 파운드리 2나노 양산을 본격화하는 등 DS 부문 사업을 강화하고 있습니다. 이러한 움직임이 회사 전체의 재무 성과에 어떤 의미를 가진다고 보시나요?",
          "direction": "DS 부문이 전체 영업이익의 중심임을 언급하고, HBM과 첨단 파운드리가 AI 시대의 핵심 인프라로서 높은 마진율과 성장 잠재력을 가지고 있어 회사 전체의 수익성 개선과 미래 성장 동력 확보에 기여함을 설명합니다."
        },
        {
          "question": "삼성전자가 미래사업기획단을 신설하고 M&A 전담팀을 강화하는 등 조직 개편을 단행했습니다. 이러한 조직 변화가 회사의 중장기 전략 방향에 어떤 시사점을 준다고 생각하나요?",
          "direction": "기존 사업의 틀을 넘어서는 신사업 발굴과 대규모 인수합병을 통해 미래 성장 동력을 적극적으로 확보하려는 삼성전자의 의지를 보여준다고 해석하고, 이를 통해 사업 포트폴리오를 다각화하려는 시도로 연결하여 답변합니다."
        },
        {
          "question": "삼성전자가 '세미콘 타이완 2026'에서 차세대 메모리 반도체 시장 선점을 위한 'CUBE' 전략을 공개했습니다. 이 전략이 삼성전자의 메모리 사업 경쟁력 강화에 어떻게 기여할 수 있을까요?",
          "direction": "CUBE 전략의 각 요소(Capacity, Utilization, Bandwidth, Efficiency)가 메모리 반도체의 생산성, 성능, 효율성을 극대화하여 AI 시대의 고성능 메모리 수요에 대응하고, 경쟁사 대비 기술 우위를 확보하는 데 중요함을 설명합니다."
        },
        {
          "question": "삼성전자가 국내에 대규모 투자를 진행하여 반도체 클러스터 구축에 집중하고 있습니다. 이러한 투자가 삼성전자의 지속 가능한 성장에 어떤 영향을 미칠 것이라고 보시나요?",
          "direction": "국내 반도체 생태계 강화, AI 반도체 등 미래 핵심 기술 분야에서의 리더십 확고화, 그리고 안정적인 생산 기반 확보를 통해 장기적인 성장 동력을 마련하는 데 기여할 것이라고 답변합니다."
        }
      ],
      "primarySources": [
        {
          "label": "삼성전자 뉴스룸",
          "url": "https://news.samsung.com/kr/"
        },
        {
          "label": "삼성전자 채용 페이지",
          "url": "https://www.samsungcareers.com/"
        },
        {
          "label": "삼성반도체 (Samsung Semiconductor)",
          "url": "https://www.samsungsemiconductor.com/kr/"
        },
        {
          "label": "DART (전자공시시스템) 삼성전자 페이지",
          "url": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260320000000"
        }
      ]
    },
    "sources": [
      {
        "id": 1,
        "title": "samsung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH4a8xZPzVA1iMonsJlIwe6XR2KkNCfXdD-AIoieUFDb19rHetdsQrnwhMMeY16ujgB_JPVj5XLG1S0G-QwcxnFBK7z3joVfhQJZyY4Om6Dbhot_zajSYQ-0M13EPF7_ZGpB4gs5LJx9krp5eDCSGFwhlHh0DWNkpHFXuAwKJVuO8k_ahZ71rgRO8sl334xR67ago8=",
        "publisher": "samsung.com",
        "excerpt": "(2026-08) 삼성전자의 사업은 크게 DS(Device Solutions)와 DX(Device eXperience) 두 개 부문으로 구성되어 있으며, 삼성디스플레이(SDC)와 하만(Harman)도 주요 사업 축이다."
      },
      {
        "id": 2,
        "title": "tojaman.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPRqNAFkX0Ozr79qwhDc4m3t7KR6UDRkkzwrwtmGpo56jtEJBp8RkBweGbGkng2WXxU3OfliVNMN1Iay8P8gLHf6XBQ7bL_bKmi9hiY1F_KcSn-hKZFWpRIPGP0AsXEcd7EIDeGLtRZ7MZhKD_wNeKs84JyR8c1eOx",
        "publisher": "tojaman.kr",
        "excerpt": "(2026-06) DS 부문은 삼성전자의 반도체 사업을 총괄하며, DRAM, NAND Flash, 모바일 AP, 카메라 센서칩, 파운드리(위탁생산), HBM(고대역폭메모리), 시스템LSI 등을 주력으로 한다."
      },
      {
        "id": 3,
        "title": "linkareer.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEgm7t8V7KzejHFbAOt4aV2W_xLthS2bYm5qpyiI2wQqBDSxvFkoQquNnfIily7KKD6m-rdKHWeEO7ul7Oe2FsLiyk8EDyXSAGz0b_jJn9r3X90xVqcf3QVfZPa-2wtcTawcode",
        "publisher": "linkareer.com",
        "excerpt": "(2026-02) DS 부문의 주요 고객은 구글, AMD 등 글로벌 빅테크 기업이며, 경쟁사는 파운드리 분야의 TSMC, 메모리 분야의 SK하이닉스, 마이크론 등이다."
      },
      {
        "id": 4,
        "title": "tistory.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGV5sIhcmmENhdjeasyPcVVd6Hyro14cJuGF4w84B-u790S-KtmUnrBkR1CV5Uac86P2W7fxoLCpO-LoWYqNkPm9NK4r-uYjuHQviZrnzKO2rbNPUpXjiS0MQ==",
        "publisher": "tistory.com",
        "excerpt": "(2026-06) DS 부문은 삼성전자의 반도체 사업을 총괄하며, DRAM, NAND Flash, 모바일 AP, 카메라 센서칩, 파운드리(위탁생산), HBM(고대역폭메모리), 시스템LSI 등을 주력으로 한다."
      },
      {
        "id": 5,
        "title": "linkareer.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEY7jR6UkAG2iHdCdTJm5k96i87uNkSUCQlyzjEX38Zl7IzbshVw83_BPsW4nMnOS2VEOOnU6f0i4IBV66mhQ1VgMjWc0aGIgFOZWs2nmyjF6qosFzdeKfQ2RpBEfgo2V0asqv_s1wYx4X7mH5hr0dw",
        "publisher": "linkareer.com",
        "excerpt": "(2026-06) DS 부문은 삼성전자의 반도체 사업을 총괄하며, DRAM, NAND Flash, 모바일 AP, 카메라 센서칩, 파운드리(위탁생산), HBM(고대역폭메모리), 시스템LSI 등을 주력으로 한다."
      },
      {
        "id": 6,
        "title": "tistory.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG7fBhfD98-zDXEgxr6nzFQvdlOk4D_1DD76tNqWxyHNLT-kild_8H09b_BzmyCJncbOGexqKOZaZiEEkqmzTDYNAMRPmo8DnItlExM-nG-8H6ge1nqXzy3SyQBfw==",
        "publisher": "tistory.com",
        "excerpt": "(2026-02) 2026년에는 DS 부문이 삼성전자 전체 이익의 82%를 벌 것으로 예상된다."
      },
      {
        "id": 7,
        "title": "arca.live",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFT23_MiCBnx3d8g38UmOqtCC9zqKckCS-eGB-G-fBWfP_iZsFjFbAC2mE0ambpvtx-wpNd7CiLZ8TUXNT7fK2iUo0rj6jgFzYwifxaw8JGmnnDczaUexeFF_uzvDsj",
        "publisher": "arca.live",
        "excerpt": "(2026-06) DS 부문은 2025년 매출액 기준 39%의 비중을 차지했으나, 2025년 영업이익의 중심이었으며, 2025년 4분기 전체 영업이익의 81.6%를 차지했다."
      },
      {
        "id": 8,
        "title": "rememberapp.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFkXu2AtAV1o2LD9F3MuKxDiqNoOBDcsl9bioUYRfFcfcNPrwHUdQbXabbVLBVLiNjmMipymzERsdBeYxjny_JsfNHy2QYVxk9eExc55kDSKAv__C-N335gAehs4-1EJMMGg7Wl3jGDgiNC",
        "publisher": "rememberapp.co.kr",
        "excerpt": "(2026-09) 2025년 기준 DX 부문이 매출의 절반 이상을 차지하지만, 영업이익의 중심은 DS 부문이다."
      },
      {
        "id": 9,
        "title": "inthenews.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFUDmmkwXz5Z3Hus200fyCHjDSbdvtRx1UxZkePEQLeI4vQruY4ur2WzoB1n0GV963T0kBByiE5JfPXBA2qnwy9LdEzdpfQSP7_zj4CL7inyHoYca7d3krXkLDSl05eXVe1W9IjhJEupot_xreEsm8_RA==",
        "publisher": "inthenews.co.kr",
        "excerpt": "(2026-01) 삼성전자는 HBM 고부가 제품 판매 확대와 메모리 가격 상승에 힘입어 역대 최대 분기 매출과 영업이익을 달성했다."
      },
      {
        "id": 10,
        "title": "jobkorea.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFEWri22ZFnXnYhouhDhxCgeabZ1barbSwi1PwKdToel8esGRizAOzEWb2Wi-LgoEdWds-g-H1d0vvPEnIowVrGelIG0hGs0n-MTT2IM6qfHZuar2RQoUDuI2BPmFdHODk3p7hZ3gj8vtkz1gowFOTC3up2h75KlZWp9d2_eqEQ9t9a",
        "publisher": "jobkorea.co.kr",
        "excerpt": "(2026-01) DX 부문의 주요 고객은 일반 소비자를 비롯해 2022년 기준 Apple, Best Buy, Deutsche Telekom, Qualcomm, Verizon 등이 주요 5대 매출처(전체 매출의 약 16%)였다."
      },
      {
        "id": 11,
        "title": "tridenstechnology.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFKD3Ngl9-Exh6vy6a88Hoo_cGE1I_MRFGHwcKmRn19MJkjU65uNl3Qj59DnwtYAlt8BHQEphAT8Uh28IcUYXIeyP8krO2HAi3KTFJM0cZKa9_pywzuFsGejht3q998NvR2RfjeyVZ5Gtd6vtN30yW_E2LjShtKmY6bPORmqvZq7Y0kW9WMvT02maA7_TOlZX4Kqnu4rA==",
        "publisher": "tridenstechnology.com",
        "excerpt": "(2026-08) DX 부문은 TV, 모니터, 생활가전(냉장고, 에어컨, 세탁기 등), 스마트폰(갤럭시 S, Z 폴드 시리즈), 네트워크 시스템, PC 등 소비자 접점의 완제품을 담당한다."
      },
      {
        "id": 12,
        "title": "jobplanet.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFX4DrqWtqyk4ZloVYLQEc6-MQMdG4GcIuxRUB98uqQwe7F_-ZLyq65Q7m96BTMqMzYr1CkSHiOmx90D2olwLn3D03nWTSe6W7eKjZPbiDevGzZyHLrVF8ghBMxZxaxQlMDDqNy-l0Fed3oE_OUJnip7pd0Gqi45zCap6w=",
        "publisher": "jobplanet.co.kr",
        "excerpt": "(2026-08) DX 부문은 TV, 모니터, 생활가전(냉장고, 에어컨, 세탁기 등), 스마트폰(갤럭시 S, Z 폴드 시리즈), 네트워크 시스템, PC 등 소비자 접점의 완제품을 담당한다."
      },
      {
        "id": 13,
        "title": "namu.wiki",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG44P7PsDzBz_gNtIqTZMjxhCeAD4-JN5lgkFVsHR3Grch0dMNcXu7qF4ujtGnKKmbO2PeqZeuZBWSTVFkEH7Kbx9alMRQ3X6t5y62LE-OtLUM5afFJzaz7iliSRuifLiC276QN7sUJ0KH6fg6k6fzElIZMzYLNA5hsNbj2vndItKetHcPC8A==",
        "publisher": "namu.wiki",
        "excerpt": "(2026-08) DX 부문은 TV, 모니터, 생활가전(냉장고, 에어컨, 세탁기 등), 스마트폰(갤럭시 S, Z 폴드 시리즈), 네트워크 시스템, PC 등 소비자 접점의 완제품을 담당한다."
      },
      {
        "id": 14,
        "title": "industrynews.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEA9qTYBVckoCjGOhYDI21kav_Ozd_TMSLIH26Ra5Hx6deD2IGpjY3ypekRtBonWHb-4TL7WMZqgVRAvCfHLjdiybmx6H08UWx_b0Bi4BNzkRdJEWSU5_FTQ6gfqyvgW9CPomGI6mRednajJhAOhAnuc-AeQKtxZ9Zwtiw=",
        "publisher": "industrynews.co.kr",
        "excerpt": "(2026-03) 삼성전자는 반도체(DS)와 가전·모바일(DX) 전 사업 영역에 걸쳐 '인공지능(AI) 중심 전략'을 공식화했다."
      },
      {
        "id": 15,
        "title": "hankyung.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQER2Lcr2PwvzBaiU_vhqIjQs29naSD0NjYgXr-gyZfevEY-H3LQQ-2ROTn2VFqzSRXVhYmF22aZ4I0J9GgjnpNQfx33IkxTManP3FFmEFlRnF6YDRpKjnR-qfQ4xLMZhFk5Qd9B2dGXUFI=",
        "publisher": "hankyung.com",
        "excerpt": "(2024-05) 삼성전자는 세계 최초 'AI폰' 갤럭시 S24 시리즈를 출시했으며, 비스포크 AI TV를 비롯해 AI 관련 냉장고, 청소기 등 신제품을 동시다발적으로 선보였다."
      },
      {
        "id": 16,
        "title": "wisereport.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGBJQf8VC3BBQj8x0-0AQJxsHngUQmqxj4vb84Y4pxt4de7KX7M2gRVTRK42yIgQB6zhaD90uhHWM5NdJVLbqmWOhJOisXB7jGIJXY98tOJc9b3CEP9ybWuSM7Ipebd8EnSC1dppmtnxduamYgf0j4TQsjaGZAdEgvE31Z18R2HGA==",
        "publisher": "wisereport.co.kr",
        "excerpt": "(2026-09) 2026년 9월 8일 기준 삼성전자의 전일 종가는 250,500원이다."
      },
      {
        "id": 17,
        "title": "bizwatch.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFPuOgOiWRe5xqDU0ao2JxALZbG3uODKvaiGe4wbDh_qWSue29E5fkIc-splNiM01-pGJhNzhmEXGSeo_8yasR6GR1EMl_Igbr6MuWi2qfcgcBN8NkRf956zQINtjUuNXh2Mn37IDPIrg4S5NXXSFwP1iwp_cNVSQ==",
        "publisher": "bizwatch.co.kr",
        "excerpt": "(2023-11) 삼성전자는 부회장급 조직으로 미래사업기획단을 신설했다."
      },
      {
        "id": 18,
        "title": "zdnet.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPXaKU04ILC9wCFvFNPeexJzA8Tkhp6qAT_SqjFXjo1KwhcL7rJ-CksPXhc5IM3mtNBIvG71EVnROpGj276FwE3-U8ubkJ4X7QSDzj4FM5SofARZxExl_VW_pFuo8WuNybSQSfGN8=",
        "publisher": "zdnet.co.kr",
        "excerpt": "(2024-11) 삼성전자는 2025년 정기 사장단 인사에서 고한승 삼성바이오에피스 대표이사 사장을 미래사업기획단장으로 임명했다."
      },
      {
        "id": 19,
        "title": "mk.co.kr",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3jB2gyVh35EQdIy_afbKt0_B5mM2R7xHlMWUwh0NcgjiL-PXBBVsiOD-V37-igSPqQqAGkm1fwgKarjMU6IZXGaRDpv6pJ_QQItNuqLJhZDM4h3KRBnyx3L4D-pifd90=",
        "publisher": "mk.co.kr",
        "excerpt": "(2023-11) 삼성전자는 부회장급 조직으로 미래사업기획단을 신설했다."
      },
      {
        "id": 20,
        "title": "newsis.com",
        "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF7RNxUOzIzy6C3KIdAzzQ1j68qXcX3jOZpcKSU7_SEJwZEBckbNOLb-AoZpYtT6WrMaM-kDBQZzOIS5zom7HasqVB4sYwPp1JTnn9KTXEunwDhGpM8ZnDY8obIUY5kYLWPFb26KCjjlW_NSOfI18SxBQ==",
        "publisher": "newsis.com",
        "excerpt": "(2024-11) 삼성전자는 2025년 정기 사장단 인사에서 고한승 삼성바이오에피스 대표이사 사장을 미래사업기획단장으로 임명했다."
      }
    ],
    "reportMeta": {
      "kind": "COMPANY",
      "schemaVersion": 1,
      "asOf": "2026-09-08",
      "searchQueries": [
        "삼성전자 사업부문 주력 제품 고객 경쟁사",
        "삼성전자 부문별 매출 비중",
        "삼성전자 DS DX 사업부문",
        "삼성전자 반도체 모바일 가전 사업 구조",
        "삼성전자 전략기획 조직",
        "삼성전자 사업부 전략기획",
        "삼성전자 미래사업기획단",
        "삼성전자 DX부문 전략",
        "삼성전자 DS부문 전략",
        "삼성전자 2025년 조직개편",
        "삼성전자 2026년 조직개편",
        "삼성전자 2025년 사업부 개편",
        "삼성전자 2026년 사업부 개편",
        "삼성전자 전략기획팀 프로젝트 2025 2026",
        "삼성전자 미래사업기획단 발표 2025 2026",
        "삼성전자 DX부문 전략팀 프로젝트 2025 2026",
        "삼성전자 DS부문 전략기획팀 프로젝트 2025 2026"
      ],
      "searchEntryPointHtml": "<style>\n.container {\n  align-items: center;\n  border-radius: 8px;\n  display: flex;\n  font-family: Google Sans, Roboto, sans-serif;\n  font-size: 14px;\n  line-height: 20px;\n  padding: 8px 12px;\n}\n.chip {\n  display: inline-block;\n  border: solid 1px;\n  border-radius: 16px;\n  min-width: 14px;\n  padding: 5px 16px;\n  text-align: center;\n  user-select: none;\n  margin: 0 8px;\n  -webkit-tap-highlight-color: transparent;\n}\n.carousel {\n  overflow: auto;\n  scrollbar-width: none;\n  white-space: nowrap;\n  margin-right: -12px;\n}\n.headline {\n  display: flex;\n  margin-right: 4px;\n}\n.gradient-container {\n  position: relative;\n}\n.gradient {\n  position: absolute;\n  transform: translate(3px, -9px);\n  height: 36px;\n  width: 9px;\n}\n@media (prefers-color-scheme: light) {\n  .container {\n    background-color: #fafafa;\n    box-shadow: 0 0 0 1px #0000000f;\n  }\n  .headline-label {\n    color: #1f1f1f;\n  }\n  .chip {\n    background-color: #ffffff;\n    border-color: #d2d2d2;\n    color: #5e5e5e;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #f2f2f2;\n  }\n  .chip:focus {\n    background-color: #f2f2f2;\n  }\n  .chip:active {\n    background-color: #d8d8d8;\n    border-color: #b6b6b6;\n  }\n  .logo-dark {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #fafafa 15%, #fafafa00 100%);\n  }\n}\n@media (prefers-color-scheme: dark) {\n  .container {\n    background-color: #1f1f1f;\n    box-shadow: 0 0 0 1px #ffffff26;\n  }\n  .headline-label {\n    color: #fff;\n  }\n  .chip {\n    background-color: #2c2c2c;\n    border-color: #3c4043;\n    color: #fff;\n    text-decoration: none;\n  }\n  .chip:hover {\n    background-color: #353536;\n  }\n  .chip:focus {\n    background-color: #353536;\n  }\n  .chip:active {\n    background-color: #464849;\n    border-color: #53575b;\n  }\n  .logo-light {\n    display: none;\n  }\n  .gradient {\n    background: linear-gradient(90deg, #1f1f1f 15%, #1f1f1f00 100%);\n  }\n}\n</style>\n<div class=\"container\">\n  <div class=\"headline\">\n    <svg class=\"logo-light\" width=\"18\" height=\"18\" viewBox=\"9 9 35 35\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M42.8622 27.0064C42.8622 25.7839 42.7525 24.6084 42.5487 23.4799H26.3109V30.1568H35.5897C35.1821 32.3041 33.9596 34.1222 32.1258 35.3448V39.6864H37.7213C40.9814 36.677 42.8622 32.2571 42.8622 27.0064V27.0064Z\" fill=\"#4285F4\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 43.8555C30.9659 43.8555 34.8687 42.3195 37.7213 39.6863L32.1258 35.3447C30.5898 36.3792 28.6306 37.0061 26.3109 37.0061C21.8282 37.0061 18.0195 33.9811 16.6559 29.906H10.9194V34.3573C13.7563 39.9841 19.5712 43.8555 26.3109 43.8555V43.8555Z\" fill=\"#34A853\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M16.6559 29.8904C16.3111 28.8559 16.1074 27.7588 16.1074 26.6146C16.1074 25.4704 16.3111 24.3733 16.6559 23.3388V18.8875H10.9194C9.74388 21.2072 9.06992 23.8247 9.06992 26.6146C9.06992 29.4045 9.74388 32.022 10.9194 34.3417L15.3864 30.8621L16.6559 29.8904V29.8904Z\" fill=\"#FBBC05\"/>\n      <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.3109 16.2386C28.85 16.2386 31.107 17.1164 32.9095 18.8091L37.8466 13.8719C34.853 11.082 30.9659 9.3736 26.3109 9.3736C19.5712 9.3736 13.7563 13.245 10.9194 18.8875L16.6559 23.3388C18.0195 19.2636 21.8282 16.2386 26.3109 16.2386V16.2386Z\" fill=\"#EA4335\"/>\n    </svg>\n    <svg class=\"logo-dark\" width=\"18\" height=\"18\" viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\">\n      <circle cx=\"24\" cy=\"23\" fill=\"#FFF\" r=\"22\"/>\n      <path d=\"M33.76 34.26c2.75-2.56 4.49-6.37 4.49-11.26 0-.89-.08-1.84-.29-3H24.01v5.99h8.03c-.4 2.02-1.5 3.56-3.07 4.56v.75l3.91 2.97h.88z\" fill=\"#4285F4\"/>\n      <path d=\"M15.58 25.77A8.845 8.845 0 0 0 24 31.86c1.92 0 3.62-.46 4.97-1.31l4.79 3.71C31.14 36.7 27.65 38 24 38c-5.93 0-11.01-3.4-13.45-8.36l.17-1.01 4.06-2.85h.8z\" fill=\"#34A853\"/>\n      <path d=\"M15.59 20.21a8.864 8.864 0 0 0 0 5.58l-5.03 3.86c-.98-2-1.53-4.25-1.53-6.64 0-2.39.55-4.64 1.53-6.64l1-.22 3.81 2.98.22 1.08z\" fill=\"#FBBC05\"/>\n      <path d=\"M24 14.14c2.11 0 4.02.75 5.52 1.98l4.36-4.36C31.22 9.43 27.81 8 24 8c-5.93 0-11.01 3.4-13.45 8.36l5.03 3.85A8.86 8.86 0 0 1 24 14.14z\" fill=\"#EA4335\"/>\n    </svg>\n    <div class=\"gradient-container\"><div class=\"gradient\"></div></div>\n  </div>\n  <div class=\"carousel\">\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGCSmRhBvtx8yC8tVxqKa6kHGqEdjfopvw9pLeSwySvILn3Y3YJkGvSswGI6_A7QKhn5yh68yhIvyXqjWLyJI-ao9gQB40FdU6eFqCRAGDgXf8B9TweKIY-AL55p0bd8_C6d8pbg7m3Tk2aWoWx1sWT8qFodrcstxgqeoxnSQ0O65wIGAXcCcR33qkA9pwvq6vkC11gYCfArG9HWkFLxdPurKTRxOI1IZtse2AOlCmK1qYVWUpxzccxrJIWFtaBUiY0gKNOaMFkBM1xFXRCl3PZat2dAV0mrk6HSHY2MGRd2Td_WiWwdiGmw8SpQgHbIRxWM0tEOvJBQtIWeDOjAnrMAFUnz8KohIpeIpE4txHpaxZgSITWenLYIA==\">삼성전자 반도체 모바일 가전 사업 구조</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEf8UuEj7IHniI4Y4qULetrTQ3nWL33EMX9puSTwnr_7y6bGFDCVr-noJ7qZ_eobhTHxWNHN1fGzZ_vUp8ImGeubzTRnw21ZfwpIj8qsrRZL-Llb-KdCuAssllP0QP07iZ4oBkjyjddnB0KxXojdB6i21ZnNvjaszFvqoJljM6cxJnsHu9aFrEKayEHU6yoxvOgYugFq9LdJK3CJsHxOHc9RW0LkjpHk3CbmO__guSQtYqOYR4Kc5mrEveYKIneRIIwZbu731ZiJq_uW9gVpjfLH8lG\">삼성전자 DS DX 사업부문</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhv3L_onzSx6RLF2Gpndg9LK9g0IOWdCfiBIs-3oZZ5KF6KmizdfWRswxPuJommVhDDUOs-jE3PyIQyoJqXwWSRaZL1ebYmz7fzbBobLcKNhuSF78XQG2AaoF_3rV65GnAtJ9WVECH7Po7CtI6qMafvHXGZ3IohOwWwaNAOF0MbawBL9vFTAZQOb26QE468tIFHBX52aTrC1tdWCYifHn0c7UxxfIh1IpUXttOpoxLtCjlbr1hM_klnv5vAThBNPzEH8Ty7xIXbFMIlbbGmrYVJChf0N5ZBf0_RYxrQtAIs-q_LmZlGrIuyTrWDAibfEMtXm7MLCGbU8uZ-dGXD8UYp5H4kLLMkPWw_JUVI0DIrOIYMhoXgH8AMr4xw6vWDXGhtg==\">삼성전자 사업부문 주력 제품 고객 경쟁사</a>\n    <a class=\"chip\" href=\"https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELGWEi7mxu63HFWn_oFAST75jGYYHZTA-Ke5C4ZrNmzLv6jNC08McWL7ChEH7C8g2039bbyfRPHro7puJSeiOctpDxfxGr0QwXoF0Cin3Ps82URnVLFlbIhqMk7Leg_KF-kiWKTy7QzltYc55NZSChLlVKwJboSB9VjNOoIhkgDD350lnjlWHxvXEQp7MIx3LLXPcn_M9rQuh4t_YfXBYDXYqAmf-u1P0TC7f-_xmKjWY5lYjCQUkE7iJRP1j1D2jRpGQHY3N_inVAmBZFU_851Wbm3PKwHscKx-7RkQKgxiVw_lYIjZJlIE0=\">삼성전자 부문별 매출 비중</a>\n  </div>\n</div>\n",
      "linkedResumeAnalysisId": null,
      "repaired": false
    }
  },
};
