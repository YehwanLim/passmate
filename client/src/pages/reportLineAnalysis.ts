// 04 문장 분석 섹션의 모바일 인터랙션에 쓰는 순수 계산과 얇은 DOM 래퍼.
// 계산은 DOM 없이 단위 테스트하고, 래퍼는 ReportResult에서만 호출한다.

/** 원문 등장 순서 배열에서 현재 카드의 이웃 카드 인덱스. 끝이거나 목록에 없으면 null. */
export function getNeighborCardIndex(
    orderedIndices: number[],
    current: number,
    delta: 1 | -1
): number | null {
    const rank = orderedIndices.indexOf(current)
    if (rank === -1) return null
    const next = orderedIndices[rank + delta]
    return next === undefined ? null : next
}

/** 가로 스크롤 컨테이너에서 자식을 가운데 놓는 scrollLeft 값(음수 없음). */
export function getHorizontalCenterOffset(input: {
    containerWidth: number
    childOffsetLeft: number
    childWidth: number
}): number {
    const { containerWidth, childOffsetLeft, childWidth } = input
    return Math.max(0, childOffsetLeft - (containerWidth - childWidth) / 2)
}

export function scrollChildIntoHorizontalView(
    container: HTMLElement | null,
    child: HTMLElement | null
) {
    if (!container || !child) return
    container.scrollTo({
        left: getHorizontalCenterOffset({
            containerWidth: container.clientWidth,
            childOffsetLeft: child.offsetLeft,
            childWidth: child.clientWidth,
        }),
        behavior: 'smooth',
    })
}

/** cubic ease-out 곡선의 elapsed 시점 스크롤 위치. duration을 넘으면 target에 고정. */
export function getScrollPositionAt(input: {
    start: number
    target: number
    elapsed: number
    duration: number
}): number {
    const { start, target, elapsed, duration } = input
    const progress = duration <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / duration))
    const eased = 1 - Math.pow(1 - progress, 3)
    return progress >= 1 ? target : start + (target - start) * eased
}

let scrollFrame: number | null = null

/**
 * 짧고 일정한 프로그램 스크롤. 브라우저 기본 smooth는 속도가 느리고 제어가 안 돼
 * 이전/다음 문장 이동에는 rAF로 직접 움직인다. reduce-motion이면 즉시 점프.
 */
export function animateScroll(container: HTMLElement | Window, targetTop: number, duration = 260) {
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
    const isWindow = container === window
    const start = isWindow ? window.scrollY : (container as HTMLElement).scrollTop
    const setTop = (top: number) => {
        if (isWindow) window.scrollTo(0, top)
        else (container as HTMLElement).scrollTop = top
    }
    if (Math.abs(targetTop - start) < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setTop(targetTop)
        return
    }
    let startedAt: number | null = null
    const frame = (timestamp: number) => {
        if (startedAt === null) startedAt = timestamp
        const elapsed = timestamp - startedAt
        setTop(getScrollPositionAt({ start, target: targetTop, elapsed, duration }))
        scrollFrame = elapsed < duration ? requestAnimationFrame(frame) : null
    }
    scrollFrame = requestAnimationFrame(frame)
}

/**
 * 첫 하이라이트 위 말풍선 위치. 말풍선은 원문 폭 안으로 밀어 넣고(clamp),
 * 꼬리(tailX)만 배지 중심을 가리키게 따로 계산한다.
 */
export function resolveCoachPlacement(input: {
    badgeCenter: number
    containerWidth: number
    bubbleWidth: number
}): { left: number; tailX: number } {
    const { badgeCenter, containerWidth, bubbleWidth } = input
    const maxLeft = Math.max(0, containerWidth - bubbleWidth)
    const left = Math.min(Math.max(0, badgeCenter - 20), maxLeft)
    const tailX = Math.min(Math.max(badgeCenter - left - 5, 12), bubbleWidth - 22)
    return { left, tailX }
}
