import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useLocation } from "wouter"
import { Check, ChevronDown, ArrowRight, FileText, Sparkles, ArrowLeft, Download, PenLine, PlusCircle, AlertTriangle, X, MessageSquareText, Type, ListChecks } from "lucide-react"
import type { ReportData } from "../types/report"
import { UI_LABELS } from "../constants/labels"
import { loadReportData, loadAnalysisFromStorage } from "../utils/storage"
import FeedbackSection from "../components/FeedbackSection"

const FALLBACK_DATA: ReportData = {
    companyInsight: {
        summary: "숫자로 증명된 실행력을 가장 중시하는 성과주의 조직",
        talentKeywords: ["데이터 기반 의사결정", "실행력", "고객 중심", "글로벌 역량", "문제 해결"],
        hiringSignals: ["정량적 성과를 수치로 제시하는 경험", "가설 수립부터 검증까지의 논리적 사고", "비즈니스 임팩트와 연결된 결과물"],
        rejectionTriggers: ["추상적 표현으로 가득한 경험 서술", "팀 내 본인 기여도가 불분명한 협업 사례", "비즈니스 가치와 연결되지 않는 단순 수치 나열"],
        cultureSignals: ["수평적 소통 문화", "빠른 실행과 피봇", "데이터 드리븐 의사결정"]
    },
    firstImpression: {
        summaryOneLiner: "데이터 기반 실행력은 강하지만, 삼성전자 기준 '제품 임팩트 연결'은 부족합니다",
        persona: "데이터 분석으로 문제를 찾고, 현장 실행력으로 해답을 증명하는 그로스 PM",
        hashtags: ["#현장실행력", "#데이터분석", "#팀리더십"]
    },
    strengths: [
        "3,000건의 현장 데이터 수집과 50곳 매장 방문은 이 회사가 가장 중시하는 '실행력'을 완벽하게 증명합니다. 단순 데스크 리서치가 아닌 발로 뛰는 데이터 수집 방식은 실무진에게 강한 인상을 남길 수 있습니다.",
        "예측 정확도 60%에서 87%로의 개선 과정은 가설-실험-개선의 사이클을 보여줍니다. 이 회사의 데이터 드리븐 문화와 정확히 일치하는 역량입니다.",
        "A/B 테스트를 통한 이탈률 개선(35% to 18%)은 구체적인 방법론과 정량적 결과를 동시에 보여주는 강력한 사례입니다."
    ],
    gaps: [
        "87%의 예측 정확도가 비즈니스적으로 어떤 가치를 창출했는지 연결이 빠져 있습니다. 이 회사 면접관은 반드시 '그래서 매출이나 비용에 어떤 영향이 있었나요?'라고 물을 것입니다.",
        "팀 프로젝트에서 본인의 구체적인 역할과 의사결정 과정이 드러나지 않습니다. '협력하여 완수했습니다'는 이 회사의 탈락 트리거 중 하나입니다.",
        "지원하는 직무와 경험의 연결고리가 약합니다. 왜 이 회사에서, 이 직무로 일하고 싶은지에 대한 전략적 서술이 필요합니다."
    ],
    positioning: {
        current: "실행력은 검증되었으나, 비즈니스 임팩트 연결이 약한 주니어 실무자",
        target: "데이터를 비즈니스 가치로 전환하는 능력을 갖춘 전략적 실무자",
        gap: "경험의 나열에서 그치고 있으며, '왜 이 회사인가'에 대한 전략적 포지셔닝이 부재합니다",
        strategy: "각 경험의 결과물을 비즈니스 지표(매출, 비용 절감, 전환율)와 연결하고, 지원 직무의 핵심 KPI와 매핑하세요. 특히 마무리 문장에서 이 회사의 구체적인 서비스명과 본인의 역량을 연결하는 것이 핵심입니다."
    },
    questionTabs: [
        {
            id: 1, title: "문항 1",
            prompt: "본인이 주도적으로 문제를 해결했던 경험을 구체적으로 서술하시오.",
            subtitleDiagnosis: { exists: true, original: "발로 뛰어 얻은 3,000개의 데이터, 정확도 87%를 달성하다", feedback: "성과가 돋보이는 좋은 소제목입니다. 다만, 어떤 비즈니스 문제를 해결했는지 목적이 드러나면 더 좋습니다.", suggestion: "악성 재고 15% 절감을 이끌어낸 3,000번의 현장 검증과 87%의 예측 모델" },
            fullAnswer: "발로 뛰어 얻은 3,000개의 데이터, 정확도 87%를 달성하다\n\n교내 캡스톤 디자인 프로젝트에서 소상공인을 위한 매출 예측 모델을 개발했습니다. 초기에는 공공 데이터만으로 모델링을 시도했으나, 지역별 특성이 반영되지 않아 예측 정확도가 60%에 머물렀습니다. 이를 해결하기 위해 팀원들과 직접 50곳 이상의 매장을 방문하여 인터뷰를 진행하고 신뢰를 쌓았습니다. 소상공인들의 협조를 얻기 어려웠지만, 여러 번 방문하여 취지를 설명했습니다.\n\n결과적으로 3,000건 이상의 실제 매출 데이터를 수집할 수 있었습니다. 수집된 데이터를 바탕으로 Python과 scikit-learn을 활용하여 예측 모델을 고도화했습니다. 예측 정확도 87%를 달성했으며, 이 성과를 인정받아 교내 캡스톤 디자인 경진대회에서 최우수상을 수상했습니다. 입사 후에도 고객 인사이트를 도출하고 비즈니스 성장에 기여하고 싶습니다.",
            overview: "실행력과 정량적 성과는 훌륭하지만, 과정의 논리적 연결과 직무 적합성 어필이 부족합니다.",
            feedbackCards: [
                { type: "praise", original: "결과적으로 3,000건 이상의 실제 매출 데이터를 수집할 수 있었습니다.", praisePoint: "구체적인 수치(3,000건)를 통해 지원자의 실행력을 증명한 훌륭한 문장입니다.", detailedAnalysis: "이 문장은 정량적 근거를 통해 실행력을 증명하는 핵심 문장입니다. '3,000건'이라는 구체적 수치는 면접관에게 지원자가 단순히 계획만 세운 것이 아니라 실제로 실행에 옮겼다는 강한 인상을 줍니다. 다만, 데이터의 품질 관리 기준이나 수집 과정에서의 의사결정 포인트를 한 줄 추가하면 더욱 설득력이 높아집니다.", interviewLink: { question: "3,000건의 데이터를 어떤 기준으로 수집했나요?", intent: "데이터 품질 관리 능력을 검증하려는 의도" } },
                { type: "praise", original: "직접 50곳 이상의 매장을 방문하여 인터뷰를 진행하고 신뢰를 쌓았습니다.", praisePoint: "현장으로 직접 나가는 능동적인 문제 해결 태도가 실무진에게 큰 호감을 줍니다.", detailedAnalysis: "이 회사가 중시하는 '현장 밀착형 실행력'을 가장 잘 보여주는 문장입니다. 50곳이라는 숫자가 구체적이고, '신뢰를 쌓았다'는 표현이 단순 방문이 아닌 관계 구축 능력까지 암시합니다. 이 문장은 자소서 전체에서 가장 강력한 차별화 포인트이므로, 가능하면 앞쪽에 배치하는 것을 권장합니다." },
                { type: "improvement", original: "소상공인들의 협조를 얻기 어려웠지만, 여러 번 방문하여 취지를 설명했습니다.", feedback: "'어려웠지만 설명했다'는 전개가 평면적입니다.", detailedAnalysis: "이 문장은 어려움 → 노력 → 결과의 서사 구조를 갖추고 있지만, '여러 번 방문하여 취지를 설명했다'는 표현이 너무 일반적입니다. 면접관은 '어떤 전략으로 설득했는가'를 보고 싶어합니다. 예를 들어, 시각화 자료를 활용한 설득, 성공 사례 공유를 통한 신뢰 구축 등 구체적인 방법론이 드러나야 합니다. 현재 문장은 '성실함'만 보여주고, '전략적 사고'는 보여주지 못합니다.", suggestion: "초기 거절에도 불구하고, 예측 모델이 가져올 '악성 재고 비용 절감' 효과를 시각화한 리포트로 설득하여 50곳의 협조를 이끌어냈습니다.", interviewLink: { question: "거절당했을 때 구체적으로 어떤 방식으로 설득했나요?", intent: "커뮤니케이션 능력과 끈기를 검증" } },
                { type: "improvement", original: "예측 정확도 87%를 달성했으며, 이 성과를 인정받아 교내 캡스톤 디자인 경진대회에서 최우수상을 수상했습니다.", feedback: "비즈니스 가치 연결 없이 학내 수상 실적으로만 마무리하고 있습니다.", detailedAnalysis: "87%라는 수치 자체는 인상적이지만, 이 수치가 '비즈니스적으로 어떤 의미인지'가 빠져 있습니다. 면접관은 정확도 향상이 매출, 비용 절감, 고객 만족도 등 어떤 지표에 영향을 미쳤는지를 궁금해합니다. 또한 '최우수상'은 학내 평가이므로 산업 현장에서의 임팩트와는 거리가 있습니다. 수상 사실 자체보다 그 모델이 실제로 적용되었을 때의 효과를 중심으로 서술하는 것이 이 회사의 채용 기준에 부합합니다.", suggestion: "시계열 예측 모델을 적용해 예측 정확도를 87%까지 끌어올렸으며, 이를 통해 소상공인들의 악성 재고 비용을 15% 이상 절감할 수 있는 솔루션을 제안하여 최우수상을 수상했습니다.", interviewLink: { question: "87%라는 정확도의 비즈니스 임팩트는 구체적으로 무엇이었나요?", intent: "성과를 비즈니스 가치로 연결하는 사고력 검증" } },
                { type: "improvement", original: "입사 후에도 고객 인사이트를 도출하고 비즈니스 성장에 기여하고 싶습니다.", feedback: "범용적인 포부 문장으로, 지원 기업 특화 메시지가 부재합니다.", detailedAnalysis: "마무리 문장은 자소서에서 '지원 동기'를 최종 확인하는 구간입니다. 현재 문장은 어떤 회사에든 복붙할 수 있는 범용 표현이라 차별화가 불가능합니다. 이 회사의 구체적인 서비스명, 최근 이슈, 또는 해당 직무의 핵심 KPI를 언급해야 면접관이 '우리 회사를 진짜 이해하고 지원했구나'라는 인상을 받습니다. 특히 자소서 마지막 문장은 면접관이 가장 마지막에 읽는 문장이므로, 가장 강한 인상을 남겨야 합니다.", suggestion: "현장에서 얻은 데이터를 비즈니스 가치로 연결했던 경험을 살려, 귀사의 주요 서비스에서 유저 이탈률을 방어하고 결제 전환율을 높이는 데이터 기반 PM이 되겠습니다.", interviewLink: { question: "우리 회사의 어떤 서비스에 기여하고 싶은가요?", intent: "지원 동기와 회사 이해도를 검증" } }
            ]
        },
        {
            id: 2, title: "문항 2",
            prompt: "팀 프로젝트에서 갈등을 해결하거나 협업을 통해 성과를 낸 경험을 작성하시오.",
            subtitleDiagnosis: { exists: false, original: "", feedback: "소제목이 비어있습니다. 면접관이 첫 줄만 읽고도 전체 내용을 파악할 수 있도록 핵심 성과를 담은 소제목을 추가하세요.", suggestion: "결제 오류율 23% 개선, A/B 테스트로 증명한 가설 검증력" },
            fullAnswer: "IT 연합 동아리에서 팀원들과 협력하여 성공적으로 프로젝트를 완수했습니다. 당시 저희 팀은 유저 이탈률이 높다는 문제를 겪고 있었습니다. 프로젝트를 통해 많은 것을 배웠고 좋은 결과를 얻었습니다. 다양한 팀원들과 협업하며 많은 것을 배웠습니다. 문제 해결 능력이 뛰어납니다. 결국 3주간 A/B 테스트를 통해 이탈률을 35%에서 18%로 개선했습니다.",
            overview: "핵심 성과(이탈률 개선)가 추상적인 문장들에 가려져 있습니다. 구체적인 방법론과 본인의 기여도를 명확히 해야 합니다.",
            feedbackCards: [
                { type: "praise", original: "결국 3주간 A/B 테스트를 통해 이탈률을 35%에서 18%로 개선했습니다.", praisePoint: "방법론, 기간, 수치가 완벽하게 결합된 이 자소서의 핵심 문장입니다.", detailedAnalysis: "해결 방법(A/B 테스트), 소요 기간(3주), 구체적인 개선 수치(35% → 18%)가 하나의 문장에 압축되어 있어 매우 효과적입니다. 이 문장만으로도 지원자의 데이터 기반 문제 해결 역량이 드러납니다. 다만 현재 자소서에서 이 문장이 가장 마지막에 위치해 있어, 앞의 추상적인 문장들에 의해 임팩트가 희석되고 있습니다. 이 문장을 첫 단락으로 올리는 역피라미드 구조를 권장합니다.", interviewLink: { question: "A/B 테스트의 가설은 무엇이었고, 대조군은 어떻게 설정했나요?", intent: "실험 설계 능력과 데이터 리터러시 검증" } },
                { type: "improvement", original: "팀원들과 협력하여 성공적으로 프로젝트를 완수했습니다.", feedback: "본인의 역할과 기여 내용이 드러나지 않는 모호한 표현입니다.", detailedAnalysis: "팀 프로젝트 경험을 서술할 때 가장 흔한 실수가 바로 이런 '우리 팀은 ~했습니다' 식의 서술입니다. 면접관이 알고 싶은 것은 팀의 성과가 아니라 '당신'의 기여입니다. 어떤 역할(기획/분석/개발)을 맡았는지, 의사결정에 어떻게 참여했는지, 갈등 상황에서 어떤 입장을 취했는지가 드러나야 합니다. 이 문장은 완전히 재작성이 필요합니다.", suggestion: "5명의 개발팀과 주 2회 스프린트 회의를 주도하며 UI/UX 개편 프로젝트의 리드 PM 역할을 수행했습니다.", interviewLink: { question: "팀에서 본인의 구체적인 역할은 무엇이었나요?", intent: "리더십과 팀 내 포지셔닝 검증" } },
                { type: "improvement", original: "프로젝트를 통해 많은 것을 배웠고 좋은 결과를 얻었습니다.", feedback: "무엇을 배웠고 어떤 결과인지 특정할 수 없는 표현입니다.", detailedAnalysis: "'많은 것'과 '좋은 결과'는 자소서에서 가장 위험한 단어 조합입니다. 면접관은 이 문장을 읽는 순간 '이 지원자는 자기 경험을 분석하지 못한다'라고 판단합니다. 구체적으로 어떤 스킬을 습득했는지(가설 수립, 데이터 분석, 유저 리서치 등), 어떤 결과물을 냈는지(MAU 증가, 전환율 개선 등)를 수치와 함께 제시해야 합니다.", suggestion: "데이터 분석을 통한 가설 수립 및 검증 프로세스를 체득했으며, 3개월간 MAU를 12만에서 28만으로 133% 성장시켰습니다.", interviewLink: { question: "구체적으로 무엇을 배웠나요?", intent: "성장 가능성과 자기 인식 수준 검증" } },
                { type: "improvement", original: "문제 해결 능력이 뛰어납니다.", feedback: "근거 없는 자기 평가는 신뢰를 떨어뜨립니다.", detailedAnalysis: "자소서에서 '~이 뛰어납니다', '~에 자신 있습니다' 같은 자기 평가형 문장은 거의 항상 마이너스 요인입니다. 면접관은 지원자의 주장이 아닌, 행동과 결과로 역량을 판단합니다. 이 문장을 삭제하고, 대신 구체적인 문제 해결 과정(문제 발견 → 원인 분석 → 해결 방안 → 실행 → 결과)을 서술하면 면접관이 스스로 '이 사람은 문제 해결력이 있다'고 판단하게 됩니다.", suggestion: "결제 이탈 구간의 퍼널 데이터를 분석하여 3가지 핵심 병목을 도출하고, 결제 프로세스를 간소화하여 오류율을 2%로 감소시켰습니다.", interviewLink: { question: "문제 해결 능력이 뛰어나다는 근거가 무엇인가요?", intent: "자기 객관화 능력 검증" } }
            ]
        }
    ],
    interviewQA: [
        { question: "이탈률 개선 시 고려한 주요 변수는 무엇이었나요?", followUps: ["변수 간 우선순위는 어떻게 정했나요?", "해당 변수가 유의미하다는 것을 어떻게 검증했나요?"], modelAnswer: "크게 세 가지 변수를 고려했습니다. 첫째, 유저 세그먼트별 이탈 시점 분석을 통해 온보딩 3일차에 급격한 이탈이 발생함을 확인했습니다. 둘째, 기능별 사용률 데이터를 분석하여 핵심 기능 발견율이 23%에 불과함을 파악했습니다. 셋째, 경쟁사 벤치마킹을 통해 푸시 알림 전략의 차이점을 발견했습니다." },
        { question: "A/B 테스트 외에 대안 방법론은 고려하지 않았나요?", followUps: ["표본 크기가 부족한 경우에는 어떻게 대응했을 건가요?", "A/B 테스트 결과의 통계적 유의성은 어떻게 검증했나요?"], modelAnswer: "A/B 테스트 외에도 다변량 테스트, 코호트 분석, 퍼널 분석 등을 활용할 수 있습니다. 특히 표본 크기가 작은 경우 베이지안 접근법을 적용하거나, 정성적 데이터가 필요할 때는 사용자 인터뷰와 세션 리플레이를 병행합니다." },
        { question: "팀 내 반대 의견이 있었을 때 어떻게 설득했나요?", followUps: ["설득에 실패한 경험은 없나요?", "의견 충돌이 해결되지 않을 때의 최종 의사결정 방식은요?"], modelAnswer: "반대 의견이 있을 때는 먼저 상대방의 우려사항을 명확히 이해하려 노력합니다. 이후 데이터 기반의 근거를 제시하고, 작은 규모의 파일럿 테스트를 제안하여 리스크를 최소화하는 방식으로 합의점을 찾습니다." },
        { question: "수집한 3,000건의 데이터 중 이상치(Outlier)는 어떻게 처리했나요?", followUps: ["이상치를 판단한 기준은 무엇인가요?", "이상치를 제거했을 때 데이터의 대표성이 훼손되지는 않았나요?"], modelAnswer: "Z-score 방식을 활용하여 평균에서 3표준편차 이상 벗어난 데이터 142건을 이상치로 식별했습니다. 이후 해당 매장의 특수한 이벤트(할인 행사 등) 여부를 수기로 확인한 후, 모델의 일반화를 해칠 우려가 있는 80건만 선별적으로 제거하여 모델의 안정성을 높였습니다." },
        { question: "소상공인들이 제공한 매출 데이터의 신뢰성은 어떻게 검증했나요?", followUps: ["포스기 데이터가 아닌 구두로 전달받은 데이터도 있었나요?", "신뢰할 수 없는 데이터가 섞여 있었다면 모델에 어떤 영향을 미쳤을까요?"], modelAnswer: "데이터의 신뢰성 확보를 위해 구두 데이터는 철저히 배제하고, POS 시스템의 엑셀 추출본이나 국세청 신고 데이터 등 객관적 증빙이 가능한 자료만 1차로 수집했습니다. 이후 요일별/시간대별 패턴 분석을 통해 인위적인 조작 가능성이 있는 비정상적인 분포를 2차로 필터링했습니다." }
    ],
    actionPlan: [
        { title: "추상적 표현 3개 문장을 정량적 성과로 교체", description: "문항 2에서 지적된 '많은 것을 배웠고', '좋은 결과', '뛰어납니다' 등을 구체적 수치와 방법론으로 재작성하세요.", expectedImpact: "면접관이 '이 사람은 근거 있이 말하는 사람이다'라는 인상을 받게 됩니다." },
        { title: "각 경험의 비즈니스 임팩트 연결 문장 추가", description: "87% 정확도, 이탈률 18% 등의 성과가 매출/비용에 어떤 영향을 미쳤는지 한 문장씩 추가하세요.", expectedImpact: "단순 실행자가 아닌 비즈니스 관점의 사고력을 가진 지원자로 포지셔닝됩니다." },
        { title: "마무리 문장에 지원 회사의 구체적 서비스명 삽입", description: "현재 '비즈니스 성장에 기여'라는 범용 표현을 지원 회사의 실제 서비스/제품명과 연결하세요.", expectedImpact: "'우리 회사를 진짜 알고 지원했구나'라는 차별화된 인상을 줍니다." }
    ],
    pmComment: "실행력은 상위 20%입니다. 다만, 지금 상태로는 '열심히 한 사람'이지 '뽑고 싶은 사람'은 아닙니다. 경험을 비즈니스 가치로 번역하는 한 줄이 빠져 있어요."
}

// =============================================================================
// NAVIGATION SECTIONS
// =============================================================================
const NAV_SECTIONS = [
    { id: 'section-first-impression', label: '01. 첫인상' },
    { id: 'section-company-insight', label: '02. 합격 기준' },
    { id: 'section-core-diagnosis', label: '03. 핵심 진단' },
    { id: 'section-line-analysis', label: '04. 문장 분석' },
    { id: 'section-interview-drill', label: '05. 예상 질문' },
    { id: 'section-action-plan', label: '06. 다음 단계' },
    { id: 'section-pm-comment', label: '07. 실무자 코멘트' },
]

// =============================================================================
// MINI NAVIGATOR
// =============================================================================
function MiniNavigator({ activeSection }: { activeSection: string }) {
    return (
        <nav className="report-nav hidden xl:block">
            <div className="space-y-0.5">
                {NAV_SECTIONS.map((sec, idx) => (
                    <a
                        key={sec.id}
                        href={`#${sec.id}`}
                        className={`report-nav-item ${activeSection === sec.id ? 'active' : ''}`}
                        onClick={(e) => {
                            e.preventDefault()
                            document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                    >
                        {sec.label}
                    </a>
                ))}
            </div>
        </nav>
    )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PassMateReport() {
    const [, navigate] = useLocation()

    // ── query parameter에서 mock 여부 판단 ──
    const searchParams = new URLSearchParams(window.location.search)
    const useMock = searchParams.get('mock') === 'true' || searchParams.get('dummy') === 'true'

    // ── sessionStorage에서 회사명/직무명 복원 (통합 구조 우선) ──
    const storedAnalysis = loadAnalysisFromStorage()
    const targetCompany = storedAnalysis?.company || sessionStorage.getItem('passmate_company') || "삼성전자"
    const userName = storedAnalysis?.jobKeyword || sessionStorage.getItem('passmate_job') || "김만득"
    const analysisId = storedAnalysis?.analysis_id || null

    const [reportData, setReportData] = useState<ReportData>(() => {
        // mock 모드: 무조건 FALLBACK_DATA 사용
        if (useMock) {
            console.log("🔥 mock 모드: FALLBACK_DATA 사용")
            return FALLBACK_DATA
        }

        // 일반 모드: 통합 스토리지 유틸리티 사용
        const data = loadReportData()
        if (data) {
            console.log("🔥 분석 결과 복원 성공")
            return data as unknown as ReportData
        }

        console.log("🔥 실제 데이터 없음 → FALLBACK_DATA 사용")
        return FALLBACK_DATA
    })

    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [activeTab, setActiveTab] = useState(0)
    const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0)
    const [completedTasks, setCompletedTasks] = useState<number[]>([])
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
    const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null)
    const [viewMode, setViewMode] = useState<'focus' | 'list'>('list')
    const [activeSection, setActiveSection] = useState(NAV_SECTIONS[0].id)
    const [showOverview, setShowOverview] = useState(true)
    const [showSubtitle, setShowSubtitle] = useState(true)

    // ── Scroll Spy (IntersectionObserver) ──
    useEffect(() => {
        const observers: IntersectionObserver[] = []
        NAV_SECTIONS.forEach((sec) => {
            const el = document.getElementById(sec.id)
            if (!el) return
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) setActiveSection(sec.id)
                },
                { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
            )
            observer.observe(el)
            observers.push(observer)
        })
        return () => observers.forEach((o) => o.disconnect())
    }, [])

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 4000)
            return () => clearTimeout(timer)
        }
    }, [toastMessage])

    const handleApiTest = async () => {
        try {
            setToastMessage({ type: 'success', text: UI_LABELS.API_TEST_SENDING })
            const res = await fetch('/api/test-gemini')
            const data = await res.json()
            if (data.ok) {
                setToastMessage({ type: 'success', text: UI_LABELS.API_TEST_SUCCESS })
            } else {
                setToastMessage({ type: 'error', text: UI_LABELS.API_TEST_FAILED + data.error })
            }
        } catch (e: any) {
            setToastMessage({ type: 'error', text: UI_LABELS.API_TEST_NETWORK_ERROR })
        }
    }

    const handleTabChange = (index: number) => {
        setActiveTab(index)
        setExpandedCards(new Set())
        setFocusedCardIndex(null)
        setShowOverview(true)
        setShowSubtitle(true)
    }

    const toggleTask = (index: number) => {
        setCompletedTasks(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])
    }

    const taskProgress = Math.round((completedTasks.length / reportData.actionPlan.length) * 100)
    const currentTab = reportData.questionTabs[activeTab]

    // 원문 텍스트 위치 기준으로 번호 재배정 (위에서부터 1, 2, 3...)
    const cardDisplayNumbers = useMemo(() => {
        const fullText = currentTab.fullAnswer
        const positions = currentTab.feedbackCards.map((card: any, idx: number) => ({
            idx, pos: fullText.indexOf(card.original)
        }))
        positions.sort((a: any, b: any) => a.pos - b.pos)
        const map: Record<number, number> = {}
        positions.forEach((p: any, rank: number) => { map[p.idx] = rank + 1 })
        return map
    }, [currentTab])

    // Sort cards by their position in the source text
    const sortedCards = useMemo(() => {
        return [...currentTab.feedbackCards].map((c: any, i: number) => ({ ...c, _origIdx: i })).sort((a: any, b: any) => {
            const posA = currentTab.fullAnswer.indexOf(a.original)
            const posB = currentTab.fullAnswer.indexOf(b.original)
            return posA - posB
        })
    }, [currentTab])

    // Character count for current answer
    const charCount = useMemo(() => {
        return currentTab.fullAnswer.replace(/\n/g, '').length
    }, [currentTab])

    const sourceTextRef = useRef<HTMLDivElement>(null)
    const commentaryRef = useRef<HTMLDivElement>(null)

    // Toggle accordion (multi-expand) and scroll source text to matching sentence
    const handleAccordionToggle = useCallback((cardIdx: number) => {
        setExpandedCards(prev => {
            const next = new Set(prev)
            if (next.has(cardIdx)) {
                next.delete(cardIdx)
            } else {
                next.add(cardIdx)
            }
            return next
        })
        setFocusedCardIndex(cardIdx)
    }, [])

    // Click source highlight → expand matching accordion and scroll to it
    const handleSourceHighlightClick = useCallback((cardIdx: number) => {
        setFocusedCardIndex(cardIdx)
        setExpandedCards(prev => {
            const next = new Set(prev)
            next.add(cardIdx)
            return next
        })
        // Use setTimeout to allow the accordion to expand before scrolling
        setTimeout(() => {
            const el = document.getElementById(`commentary-item-${cardIdx}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }, 50)
    }, [])

    return (
        <main className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-indigo-500/20">
            <MiniNavigator activeSection={activeSection} />
            <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10">
                {/* TOP NAV */}
                <div className="pt-8 pb-4 flex items-center justify-between">
                    <button onClick={() => navigate("/analyze")} className="inline-flex items-center gap-2.5 text-sm text-zinc-500 hover:text-white transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span>{UI_LABELS.BACK}</span>
                    </button>
                    <button onClick={handleApiTest} className="text-[11px] text-zinc-600 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 hover:text-zinc-400 transition-all">
                        {UI_LABELS.API_TEST}
                    </button>
                </div>

                {/* Mock 모드 안내 배너 */}
                {useMock && (
                    <div className="mt-2 mb-4 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs text-amber-400">현재 더미 데이터(mock)가 표시되고 있습니다. 실제 분석 결과를 보려면 분석 페이지에서 다시 시도하세요.</span>
                    </div>
                )}

                {/* ================================================================= */}
                {/* ACT 1: FIRST IMPRESSION */}
                {/* ================================================================= */}
                <header id="section-first-impression" className="pt-8 pb-24 section-divider">
                    <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-white tracking-tight leading-snug md:leading-snug text-balance mb-8">
                        {UI_LABELS.FIRST_IMPRESSION_TITLE(userName)}
                    </h1>

                    <p className="text-lg sm:text-xl text-zinc-200 leading-[1.7] mb-10 max-w-3xl font-medium">
                        {reportData.firstImpression.summaryOneLiner}
                    </p>

                    {/* Persona + Hashtags — Primary Card */}
                    <div className="bg-white/[0.02] border border-white/[0.05] p-7 rounded-xl">
                        <p className="text-sm text-zinc-500 uppercase tracking-[0.15em] mb-3 font-medium">{UI_LABELS.APPLICANT_PROFILE}</p>
                        <p className="text-[17px] text-zinc-100 font-medium leading-[1.7] mb-5">{reportData.firstImpression.persona}</p>
                        <div className="flex flex-wrap gap-2">
                            {reportData.firstImpression.hashtags.map((tag: string) => (
                                <span key={tag} className="px-3 py-1.5 text-xs text-zinc-400 bg-white/[0.03] border border-white/[0.04] rounded-full font-medium">{tag}</span>
                            ))}
                        </div>
                    </div>
                </header>

                {/* ================================================================= */}
                {/* ACT 1.5: COMPANY INSIGHT */}
                {/* ================================================================= */}
                <section id="section-company-insight" className="py-24 section-divider">
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.COMPANY_ANALYSIS}</h2>
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight">{UI_LABELS.HIRING_CRITERIA(targetCompany)}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.75]">{reportData.companyInsight.summary}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Talent Keywords */}
                        <div className="py-2">
                            <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.TALENT_PROFILE}</p>
                            <div className="flex flex-wrap gap-2.5">
                                {reportData.companyInsight.talentKeywords.map((kw) => (
                                    <span key={kw} className="px-4 py-2 text-sm text-zinc-200 bg-white/[0.04] border border-white/[0.05] rounded-lg font-medium">{kw}</span>
                                ))}
                            </div>
                        </div>

                        {/* Hiring Signals */}
                        <div className="py-2">
                            <p className="text-sm text-emerald-400/70 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.ACCEPTANCE_CRITERIA}</p>
                            <ul className="space-y-3">
                                {reportData.companyInsight.hiringSignals.map((s, i) => (
                                    <li key={i} className="text-[15px] text-zinc-200 leading-[1.7] flex items-start gap-2.5">
                                        <Check className="w-4 h-4 text-emerald-400/50 mt-0.5 shrink-0" />{s}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Rejection Triggers */}
                        <div className="py-2">
                            <p className="text-sm text-rose-400/60 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.REJECTION_TRIGGERS}</p>
                            <ul className="space-y-3">
                                {reportData.companyInsight.rejectionTriggers.map((r, i) => (
                                    <li key={i} className="text-[15px] text-zinc-400 leading-[1.7] flex items-start gap-2.5">
                                        <X className="w-4 h-4 text-rose-400/35 mt-0.5 shrink-0" />{r}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Culture Signals */}
                        <div className="py-2">
                            <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-5 font-semibold">{UI_LABELS.CULTURE_SIGNALS}</p>
                            <ul className="space-y-3">
                                {reportData.companyInsight.cultureSignals.map((c, i) => (
                                    <li key={i} className="text-[15px] text-zinc-400 leading-[1.7] flex items-start gap-2.5">
                                        <div className="w-[5px] h-[5px] rounded-full bg-zinc-600 mt-[9px] shrink-0"></div>{c}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 2: CORE DIAGNOSIS */}
                {/* ================================================================= */}
                <section id="section-core-diagnosis" className="py-24 section-divider">
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.CORE_DIAGNOSIS}</h2>
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-14 tracking-tight">{UI_LABELS.STRENGTHS_AND_GAPS(targetCompany)}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                        <div>
                            <p className="text-sm text-emerald-400/70 uppercase tracking-[0.12em] mb-6 font-semibold">{UI_LABELS.STRENGTHS}</p>
                            <div className="space-y-5">
                                {reportData.strengths.map((s, i) => (
                                    <div key={i} className="pl-0 py-0">
                                        <p className="text-[16px] text-zinc-100 leading-[1.8] font-normal">{s}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-amber-300/60 uppercase tracking-[0.12em] mb-6 font-semibold">{UI_LABELS.GAPS}</p>
                            <div className="space-y-5">
                                {reportData.gaps.map((g, i) => (
                                    <div key={i} className="pl-0 py-0">
                                        <p className="text-[16px] text-zinc-300 leading-[1.8] font-normal">{g}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Positioning */}
                    <div className="bg-white/[0.03] border border-white/[0.05] p-8 rounded-xl backdrop-blur-sm">
                        <p className="text-sm text-zinc-400 uppercase tracking-[0.12em] mb-7 font-semibold">{UI_LABELS.STRATEGIC_POSITIONING}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-7">
                            <div>
                                <span className="inline-block px-3 py-1.5 bg-zinc-800/80 border border-white/[0.05] rounded-md text-xs font-semibold text-zinc-300 mb-3">{UI_LABELS.POSITION_CURRENT}</span>
                                <p className="text-base text-zinc-400 leading-[1.7] mt-1">{reportData.positioning.current}</p>
                            </div>
                            <div>
                                <span className="inline-block px-3 py-1.5 bg-zinc-800/80 border border-white/[0.05] rounded-md text-xs font-semibold text-zinc-300 mb-3">{UI_LABELS.POSITION_TARGET}</span>
                                <p className="text-[17px] text-white font-bold leading-[1.7] mt-1">{reportData.positioning.target}</p>
                            </div>
                        </div>
                        <div className="border-t border-white/[0.04] pt-6 space-y-7">
                            <div>
                                <span className="inline-block px-3 py-1.5 bg-zinc-800/80 border border-white/[0.05] rounded-md text-xs font-semibold text-zinc-300 mb-3">{UI_LABELS.POSITION_GAP}</span>
                                <p className="text-base text-amber-300 font-semibold leading-[1.7] mt-1">{reportData.positioning.gap}</p>
                            </div>
                            <div>
                                <span className="inline-block px-3 py-1.5 bg-zinc-800/80 border border-white/[0.05] rounded-md text-xs font-semibold text-zinc-300 mb-3">{UI_LABELS.POSITION_STRATEGY}</span>
                                <p className="text-[15px] text-zinc-300 leading-[1.7] mt-1">{reportData.positioning.strategy}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </article>

            {/* ================================================================= */}
            {/* ACT 3: LINE-BY-LINE ANALYSIS — Editorial Review Workspace */}
            {/* ================================================================= */}
            <section id="section-line-analysis" className="py-24 section-divider max-w-[1440px] mx-auto px-6 md:px-10"
                onClick={(e) => {
                    // Click-outside: reset highlight if clicking empty area
                    if ((e.target as HTMLElement).closest('.annotation-hl') || (e.target as HTMLElement).closest('.commentary-trigger') || (e.target as HTMLElement).closest('.commentary-body') || (e.target as HTMLElement).closest('.view-mode-toggle')) return
                    setFocusedCardIndex(null)
                    setExpandedCards(new Set())
                }}>
                <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.DETAILED_DIAGNOSIS}</h2>
                <h3 className="text-xl sm:text-2xl font-semibold text-white mb-10 tracking-tight">{UI_LABELS.LINE_BY_LINE_ANALYSIS}</h3>

                {/* Split View: Source (Left) + Commentary (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-0 lg:items-start">

                    {/* ═══ LEFT PANEL: Source Text ═══ */}
                    <div ref={sourceTextRef} className="lg:pr-10 lg:sticky lg:top-[10vh] lg:self-start lg:max-h-[85vh] lg:overflow-y-auto hide-scrollbar">
                        {/* Document Header */}
                        <div className="doc-header mb-6">
                            <span>{targetCompany}</span>
                            <span className="separator">·</span>
                            <span>{userName}</span>
                        </div>

                        {/* Section Navigator Tabs */}
                        <div className="flex items-center border-b border-white/[0.06] mb-8">
                            {reportData.questionTabs.map((tab, index) => (
                                <button key={tab.id} onClick={() => handleTabChange(index)}
                                    className={`section-tab ${activeTab === index ? 'active' : ''}`}>
                                    {tab.title}
                                </button>
                            ))}
                        </div>

                        {/* Question Prompt */}
                        <div className="mb-8">
                            <p className="question-prompt">{currentTab.prompt}</p>
                        </div>

                        {/* Source Text Body */}
                        <div className={`source-text-body ${focusedCardIndex !== null ? 'original-text-dimmed' : ''}`}>
                            {currentTab.fullAnswer.split('\n').map((paragraph: string, pIdx: number) => (
                                <p key={pIdx}>
                                    {(() => {
                                        const highlights = currentTab.feedbackCards.map((c: any) => c.original)
                                        let result: React.ReactNode[] = []
                                        let remaining = paragraph
                                        let keyCounter = 0
                                        while (remaining.length > 0) {
                                            let earliestIdx = remaining.length
                                            let matchedHighlight = ''
                                            let matchedCardIdx = -1
                                            highlights.forEach((h: string, hIdx: number) => {
                                                const pos = remaining.indexOf(h)
                                                if (pos !== -1 && pos < earliestIdx) {
                                                    earliestIdx = pos
                                                    matchedHighlight = h
                                                    matchedCardIdx = hIdx
                                                }
                                            })
                                            if (matchedHighlight) {
                                                if (earliestIdx > 0) result.push(remaining.slice(0, earliestIdx))
                                                const isActive = focusedCardIndex === matchedCardIdx
                                                const cardType = currentTab.feedbackCards[matchedCardIdx]?.type
                                                const typeClass = cardType === 'praise' ? 'praise-hl' : 'improvement-hl'
                                                const displayNum = cardDisplayNumbers[matchedCardIdx] ?? (matchedCardIdx + 1)
                                                result.push(
                                                    <span key={`hl-${pIdx}-${keyCounter++}`}
                                                        id={`source-sentence-${matchedCardIdx}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleSourceHighlightClick(matchedCardIdx)
                                                        }}
                                                        className={`annotation-hl ${typeClass} ${isActive ? 'active' : ''}`}>
                                                        <span className="annotation-badge">
                                                            {displayNum}
                                                        </span>
                                                        {matchedHighlight}
                                                    </span>
                                                )
                                                remaining = remaining.slice(earliestIdx + matchedHighlight.length)
                                            } else {
                                                result.push(remaining)
                                                remaining = ''
                                            }
                                        }
                                        return result
                                    })()}
                                </p>
                            ))}
                        </div>

                        {/* Character Count */}
                        <div className="mt-10 pt-6 border-t border-white/[0.04]">
                            <span className="char-count">{charCount.toLocaleString()}자</span>
                        </div>
                    </div>

                    {/* ═══ RIGHT PANEL: AI Commentary ═══ */}
                    <div ref={commentaryRef} className="lg:sticky lg:top-[10vh] lg:self-start lg:h-[85vh] flex flex-col lg:border-l border-white/[0.06] lg:pl-8 mt-10 lg:mt-0">
                        {/* Panel Header + View Mode Toggle */}
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <p className="text-xs text-zinc-500 uppercase tracking-[0.15em] font-semibold">{UI_LABELS.AI_COMMENTARY}</p>
                            <div className="view-mode-toggle">
                                <button onClick={() => setViewMode('list')}
                                    className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}>
                                    {UI_LABELS.VIEW_MODE_LIST}
                                </button>
                                <button onClick={() => setViewMode('focus')}
                                    className={`view-mode-btn ${viewMode === 'focus' ? 'active' : ''}`}>
                                    {UI_LABELS.VIEW_MODE_FOCUS}
                                </button>
                            </div>
                        </div>

                        {/* Scrolling Content Area */}
                        <div className="flex-1 overflow-y-auto commentary-scroll pr-2 pb-10">

                        {/* Overview — Collapsible */}
                        <div className="mb-4 bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors">
                            <button onClick={() => setShowOverview(!showOverview)}
                                className="w-full flex items-center justify-between text-left group">
                                <span className="commentary-section-label panel-header flex items-center gap-3 text-zinc-50" style={{ margin: 0, border: 'none', padding: 0 }}><MessageSquareText className="w-5 h-5 text-zinc-300" />{UI_LABELS.OVERVIEW}</span>
                                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showOverview ? 'rotate-180' : ''}`} />
                            </button>
                            {showOverview && (
                                <div className="pt-4 mt-4 border-t border-white/[0.04]">
                                    <p className="text-[14px] text-zinc-300 leading-[1.8]">{currentTab.overview}</p>
                                </div>
                            )}
                        </div>

                        {/* Subtitle Diagnosis — Collapsible */}
                        <div className="mb-4 bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors">
                            <button onClick={() => setShowSubtitle(!showSubtitle)}
                                className="w-full flex items-center justify-between text-left group">
                                <span className="commentary-section-label panel-header flex items-center gap-3 text-zinc-50" style={{ margin: 0, border: 'none', padding: 0 }}><Type className="w-5 h-5 text-zinc-300" />{UI_LABELS.SUBTITLE_DIAGNOSIS}</span>
                                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showSubtitle ? 'rotate-180' : ''}`} />
                            </button>
                            {showSubtitle && (
                                <div className="pt-4 mt-4 border-t border-white/[0.04]">
                                    {currentTab.subtitleDiagnosis.exists ? (
                                        <div className="space-y-0">
                                            <p className="commentary-body-text mb-4">{currentTab.subtitleDiagnosis.feedback}</p>
                                            
                                            <p className="commentary-label">소제목 수정 제안</p>
                                            <p className="commentary-headline mb-0">{currentTab.subtitleDiagnosis.suggestion}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0">
                                            <p className="commentary-body-text mb-4">{currentTab.subtitleDiagnosis.feedback}</p>
                                            
                                            <p className="commentary-label" style={{ marginTop: '0' }}>소제목 수정 제안</p>
                                            <p className="commentary-headline mb-0">{currentTab.subtitleDiagnosis.suggestion}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Section Header: 문장 진단 */}
                        <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-6">
                                <ListChecks className="w-5 h-5 text-zinc-300" />
                                <span className="commentary-section-label panel-header text-zinc-50" style={{ margin: 0, border: 'none', padding: 0 }}>{UI_LABELS.SENTENCE_DIAGNOSIS}</span>
                            </div>

                        {/* ── Focus Mode: Full content for focused card ── */}
                        {viewMode === 'focus' && (
                            <div>
                                {focusedCardIndex !== null ? (() => {
                                    const card = currentTab.feedbackCards[focusedCardIndex] as any
                                    if (!card) return null
                                    const displayNum = cardDisplayNumbers[focusedCardIndex] ?? (focusedCardIndex + 1)
                                    return (
                                        <div className="focus-card">
                                            {/* Number + Original */}
                                            <div className="flex items-start gap-3 mb-5">
                                                <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${card.type === 'praise' ? 'bg-[#4ADE80] text-[#111]' : 'bg-[#FBBF24] text-[#111]'}`}>
                                                    {displayNum}
                                                </span>
                                                <p className="text-[14px] text-zinc-300 leading-[1.7] italic flex-1">"{card.original}"</p>
                                            </div>

                                            {/* Detailed Analysis */}
                                            <p className="commentary-body-text mb-4">{card.detailedAnalysis || (card.type === 'improvement' ? card.feedback : card.praisePoint)}</p>

                                            {/* Interview perspective */}
                                            {card.interviewLink && (
                                                <>
                                                    <p className="commentary-label">예상 면접 질문</p>
                                                    <p className="commentary-headline">"{card.interviewLink.question}"</p>
                                                    <p className="commentary-meta mb-4">{UI_LABELS.QUESTION_INTENT}: {card.interviewLink.intent}</p>
                                                </>
                                            )}

                                            {/* Improvement suggestion */}
                                            {card.type === 'improvement' && card.suggestion && (
                                                <>
                                                    <p className="commentary-label">개선한 문장</p>
                                                    <p className="commentary-headline">{card.suggestion}</p>
                                                </>
                                            )}
                                        </div>
                                    )
                                })() : (
                                    <div className="py-12 text-center">
                                        <p className="text-sm text-zinc-600 leading-relaxed">{UI_LABELS.CLICK_HIGHLIGHT_GUIDE}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── List Mode: Accordion ── */}
                        {viewMode === 'list' && (
                            <div>
                                {sortedCards.map((card: any) => {
                                    const realIdx = card._origIdx
                                    const isExpanded = expandedCards.has(realIdx)
                                    const isFocused = focusedCardIndex === realIdx
                                    const displayNum = cardDisplayNumbers[realIdx] ?? (realIdx + 1)
                                    const previewText = card.type === 'improvement' ? card.feedback : card.praisePoint

                                    return (
                                        <div key={realIdx}
                                            id={`commentary-item-${realIdx}`}
                                            className={`commentary-item ${card.type} ${isExpanded ? 'expanded' : ''} ${isFocused && !isExpanded ? 'focused' : ''}`}>

                                            {/* Trigger */}
                                            <button className="commentary-trigger" onClick={() => handleAccordionToggle(realIdx)}>
                                                <span className="commentary-num">{displayNum}</span>
                                                <span className="commentary-preview flex-1 min-w-0">{previewText}</span>
                                                <ChevronDown className="commentary-chevron" />
                                            </button>

                                            {/* Body */}
                                            <div className="commentary-body pt-2">
                                                {/* Detailed Analysis */}
                                                <p className="commentary-body-text mb-4">{card.detailedAnalysis || (card.type === 'improvement' ? card.feedback : card.praisePoint)}</p>

                                                {/* Interview perspective */}
                                                {card.interviewLink && (
                                                    <>
                                                        <p className="commentary-label">예상 면접 질문</p>
                                                        <p className="commentary-headline">"{card.interviewLink.question}"</p>
                                                        <p className="commentary-meta mt-1">{UI_LABELS.QUESTION_INTENT}: {card.interviewLink.intent}</p>
                                                    </>
                                                )}

                                                {/* Improvement suggestion */}
                                                {card.type === 'improvement' && card.suggestion && (
                                                    <>
                                                        <p className="commentary-label">개선한 문장</p>
                                                        <p className="commentary-headline">{card.suggestion}</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        </div>

                        </div> {/* End Scrolling Content Area */}
                    </div>
                </div>
            </section>



            <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10">

                {/* ================================================================= */}
                {/* ACT 4: INTERVIEW DRILL */}
                {/* ================================================================= */}
                <section id="section-interview-drill" className="pt-24 pb-24 section-divider">
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.INTERVIEW_DRILL}</h2>
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight">{UI_LABELS.INTERVIEW_DRILL_TITLE}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.7]">{UI_LABELS.INTERVIEW_DRILL_DESC}</p>

                    <div className="space-y-0">
                        {reportData.interviewQA.map((item, index) => (
                            <div key={index} className="border-b border-white/[0.04] last:border-0">
                                <button onClick={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
                                    className="w-full py-6 flex items-start gap-5 text-left group">
                                    <span className="text-xs uppercase tracking-[0.12em] text-zinc-500 mt-1 min-w-[50px] font-medium">Q{index + 1}</span>
                                    <span className="flex-1 text-[17px] text-zinc-300 group-hover:text-white transition-colors leading-[1.6]">{item.question}</span>
                                    <ChevronDown className={`w-5 h-5 text-zinc-600 transition-transform mt-0.5 ${openQuestionIndex === index ? "rotate-180" : ""}`} />
                                </button>
                                {openQuestionIndex === index && (
                                    <div className="pb-8 pl-[70px] space-y-4">
                                        {item.followUps && item.followUps.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs uppercase tracking-[0.12em] text-amber-300/50 mb-3 font-medium">{UI_LABELS.FOLLOW_UP_QUESTIONS}</p>
                                                <ul className="space-y-2">
                                                    {item.followUps.map((fu, fi) => (
                                                        <li key={fi} className="text-[15px] text-zinc-500 leading-[1.7] flex items-start gap-2.5">
                                                            <ArrowRight className="w-3 h-3 text-amber-300/35 mt-1.5 shrink-0" />{fu}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-3 font-medium">{UI_LABELS.MODEL_ANSWER}</p>
                                        <p className="text-[15px] text-zinc-400 leading-[1.8]">{item.modelAnswer}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 5: ACTION PLAN */}
                {/* ================================================================= */}
                <section id="section-action-plan" className="py-24 section-divider">
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.ACTION_PLAN}</h2>
                    <h3 className="text-xl sm:text-2xl font-semibold text-white mb-6 tracking-tight">{UI_LABELS.ACTION_PLAN_TITLE}</h3>

                    <div className="flex items-center gap-5 mb-14 mt-10">
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500/70 transition-all duration-500" style={{ width: `${taskProgress}%` }} />
                        </div>
                        <span className="text-sm text-zinc-500 tabular-nums">{completedTasks.length}/{reportData.actionPlan.length}</span>
                    </div>

                    <div className="space-y-0">
                        {reportData.actionPlan.map((task, index) => {
                            const isComplete = completedTasks.includes(index)
                            return (
                                <button key={index} onClick={() => toggleTask(index)} className="w-full text-left py-5 flex items-start gap-5 group border-b border-white/[0.03] last:border-0">
                                    <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5 ${isComplete ? "bg-indigo-500 border-indigo-500" : "border-zinc-700 group-hover:border-zinc-500"}`}>
                                        {isComplete && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className={`text-base transition-colors leading-[1.6] block mb-1.5 ${isComplete ? "line-through text-zinc-600" : "text-zinc-200 group-hover:text-white"}`}>{task.title}</span>
                                        <p className={`text-[15px] transition-colors leading-[1.7] ${isComplete ? "text-zinc-700" : "text-zinc-500"}`}>{task.description}</p>
                                        <p className={`text-sm mt-2.5 transition-colors ${isComplete ? "text-zinc-700" : "text-emerald-400/50"}`}>{UI_LABELS.EXPECTED_IMPACT}: {task.expectedImpact}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* ================================================================= */}
                {/* ACT 6: PM COMMENT */}
                {/* ================================================================= */}
                <section id="section-pm-comment" className="pt-24 pb-20 section-divider">
                    <h2 className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.PM_VERDICT}</h2>
                    <h3 className="text-xl sm:text-2xl font-medium text-white mb-10 tracking-tight">{UI_LABELS.PM_VERDICT_TITLE}</h3>
                    <div className="flex items-start gap-5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-indigo-400 text-xs font-bold tracking-tight">H</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-sm font-medium text-white">Mentor Hansi</span>
                                <span className="text-xs text-zinc-600">{UI_LABELS.JUST_NOW}</span>
                            </div>
                            <div className="border-l-2 border-indigo-400/20 pl-5">
                                <p className="text-[17px] text-zinc-200 leading-[1.8] font-normal">{reportData.pmComment}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ================================================================= */}
                {/* FEEDBACK SECTION */}
                {/* ================================================================= */}
                <FeedbackSection analysisId={analysisId} />

                {/* ================================================================= */}
                {/* PREMIUM UPSELL */}
                {/* ================================================================= */}
                <section className="py-24">
                    <h2 className="text-xs uppercase tracking-[0.15em] text-zinc-500 mb-4 font-medium">{UI_LABELS.PREMIUM}</h2>
                    <h3 className="text-2xl sm:text-3xl font-medium text-white mb-6 tracking-tight">{UI_LABELS.PREMIUM_NEXT_STEPS}</h3>
                    <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.7]">{UI_LABELS.PREMIUM_DESC}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group relative bg-white/[0.02] border border-white/[0.04] rounded-xl p-8 hover:border-white/[0.08] transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center mb-6">
                                <FileText className="w-5 h-5 text-zinc-400" />
                            </div>
                            <h4 className="text-lg font-medium text-white mb-3">{UI_LABELS.PAST_QUESTIONS}</h4>
                            <p className="text-[15px] text-zinc-500 leading-[1.7] mb-8">{UI_LABELS.PAST_QUESTIONS_DESC}</p>
                            <button className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group/btn">
                                <span>{UI_LABELS.GO_TO}</span><ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        <div className="group relative bg-white/[0.02] border border-white/[0.04] rounded-xl p-8 hover:border-white/[0.08] transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center mb-6">
                                <Sparkles className="w-5 h-5 text-zinc-400" />
                            </div>
                            <h4 className="text-lg font-medium text-white mb-3">{UI_LABELS.EXPERT_REVIEW}</h4>
                            <p className="text-[15px] text-zinc-500 leading-[1.7] mb-8">{UI_LABELS.EXPERT_REVIEW_DESC}</p>
                            <button className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2 group/btn">
                                <span>{UI_LABELS.APPLY_PREMIUM}</span><ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* NEXT STEP */}
                <section className="py-16 mt-10 bg-white/[0.02] rounded-xl border border-white/[0.04] px-6 md:px-10 text-center">
                    <h3 className="text-xl font-medium text-white mb-8">{UI_LABELS.WHATS_NEXT}</h3>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button onClick={() => navigate("/analyze")} className="w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                            <PenLine className="w-4 h-4" /><span>{UI_LABELS.EDIT_RESUME}</span>
                        </button>
                        <button onClick={() => navigate("/")} className="w-full sm:w-auto px-6 py-3.5 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                            <PlusCircle className="w-4 h-4" /><span>{UI_LABELS.ANALYZE_NEW}</span>
                        </button>
                        <button className="w-full sm:w-auto px-6 py-3.5 bg-transparent border border-white/10 text-zinc-300 font-medium rounded-lg hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-2">
                            <Download className="w-4 h-4" /><span>{UI_LABELS.SAVE_REPORT}</span>
                        </button>
                    </div>
                </section>

                {/* FOOTER */}
                <footer className="pt-20 pb-8 mt-10">
                    <p className="text-xs text-zinc-600 leading-relaxed mb-6 text-center">{UI_LABELS.FOOTER_DISCLAIMER}</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-zinc-600">
                        <p>PassMate 2026. All rights reserved.</p>
                        <span className="hidden sm:inline">-</span>
                        <p>Report ID: RPT-2026-0430-{Math.random().toString(36).slice(2, 6).toUpperCase()}</p>
                    </div>
                </footer>
            </article>


            {/* Toast */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-fade-in">
                    <div className={`px-5 py-3 rounded-xl border shadow-2xl shadow-black/40 backdrop-blur-xl text-sm font-medium max-w-md ${toastMessage.type === 'success' ? 'bg-zinc-900/95 border-green-500/30 text-green-400' : 'bg-zinc-900/95 border-red-500/30 text-red-400'}`}>
                        {toastMessage.text}
                    </div>
                </div>
            )}
        </main>
    )
}
