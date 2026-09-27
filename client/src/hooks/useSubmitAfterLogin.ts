import { useEffect, useRef } from "react";

/**
 * "분석 시작"을 눌렀는데 로그인이 없어 모달이 뜬 경우, 로그인이 끝나는 순간 제출을 대신 눌러 준다.
 * 사용자가 이미 한 번 누른 의도를 잇는 것이라, 누른 적이 없으면(다른 탭 로그인·헤더 로그인) 아무것도 하지 않는다.
 *
 * - arm(): 모달을 여는 쪽에서 부른다. disarm(): 모달을 닫으면 부른다.
 * - initiallyArmed: 카카오 로그인은 페이지를 떠났다 돌아오므로, 초안의 submitOnReturn 으로 마운트 때 켠다.
 * - onSubmit 은 최신 클로저를 쓴다(폼 상태를 닫아 둔 handleSubmit).
 */
export function useSubmitAfterLogin({
  isAuthenticated,
  onSubmit,
  initiallyArmed = false,
}: {
  isAuthenticated: boolean;
  onSubmit: () => void;
  initiallyArmed?: boolean;
}) {
  const armedRef = useRef(initiallyArmed);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    if (!isAuthenticated || !armedRef.current) return;
    armedRef.current = false;
    submitRef.current();
  }, [isAuthenticated]);

  return {
    arm: () => {
      armedRef.current = true;
    },
    disarm: () => {
      armedRef.current = false;
    },
  };
}
