async function testAPI() {
    const res = await fetch("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            company: "삼성전자",
            job: "PM",
            questions: [
                {
                    question: "본인이 주도적으로 문제를 해결한 경험을 구체적으로 서술하시오.",
                    answer: `
교내 캡스톤 프로젝트에서 소상공인을 위한 매출 예측 모델을 개발했습니다.
초기에는 공공 데이터를 활용했지만 정확도가 낮았습니다.
이를 해결하기 위해 직접 50개 이상의 매장을 방문하여 인터뷰를 진행하고,
3,000건 이상의 실제 데이터를 수집했습니다.
그 결과 예측 정확도를 87%까지 개선할 수 있었습니다.
          `,
                },
            ],
        }),
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testAPI();