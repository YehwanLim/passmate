#!/bin/zsh
# 네이버 블로그 편집기 자동 입력 래퍼 (agent-browser).
# 전용 프로필에 사용자가 직접 로그인해 두면 이후 실행에서도 로그인이 유지된다.
# 발행 버튼은 절대 누르지 않는다. 임시저장("저장" 버튼)까지만.
#
# 사용:
#   scripts/naver-blog.sh check-login            # 로그인 상태면 "logged-in", 아니면 "logged-out" 출력
#   scripts/naver-blog.sh login                  # 로그인 창을 화면에 띄움(사용자가 직접 로그인)
#   scripts/naver-blog.sh post <draft.md>        # 초안 md(1행 제목, 빈 줄, 본문)를 편집기에 넣고 임시저장
#   scripts/naver-blog.sh screenshot <out.png>   # 현재 화면 캡처
#   scripts/naver-blog.sh reset                  # 데몬·브라우저 완전 종료(옵션 바꿀 때)
#   scripts/naver-blog.sh ab <agent-browser args> # 같은 세션으로 임의 명령
set -u
PROFILE="$HOME/.agent-browser-profiles/naver-blog"
SESSION="naver-blog"
AB=(agent-browser --session "$SESSION" --headed --profile "$PROFILE" --idle-timeout 0)
WRITE_URL="https://blog.naver.com/GoBlogWrite.naver"
HOME_URL="https://section.blog.naver.com/BlogHome.naver"
# 편집기 좌표(CSS px, 뷰포트 1200×646 기준). 제목/본문 첫 줄.
TITLE_X=186; TITLE_Y=249; BODY_X=258; BODY_Y=360

ab() { "${AB[@]}" "$@"; }
click_at() { ab mouse move "$1" "$2" >/dev/null && ab mouse down >/dev/null && ab mouse up >/dev/null; }
# 문단 서식 드롭다운은 토글이라, 닫혀 있을 때만 열고 옵션(소제목|본문)을 고른다.
setstyle() {
  local snap r exp
  snap="$(ab snapshot -i -c -d 14 2>/dev/null)"
  exp="$(echo "$snap" | grep 'button "문단 서식 변경"' | grep -o 'expanded=[a-z]*')"
  if [ "$exp" = "expanded=false" ]; then
    r="$(echo "$snap" | grep 'button "문단 서식 변경"' | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"; ab click "@$r" >/dev/null 2>&1; sleep 0.4
  fi
  r="$(ab snapshot -i -c -d 14 2>/dev/null | grep "button \"$1" | head -1 | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"
  [ -n "$r" ] && ab click "@$r" >/dev/null 2>&1; sleep 0.3
}

cmd="${1:-}"; shift || true
case "$cmd" in
  check-login)
    ab open "$HOME_URL" >/dev/null 2>&1; ab wait --load networkidle >/dev/null 2>&1
    if ab snapshot -i -c -d 12 2>/dev/null | grep -q '"로그아웃"'; then echo logged-in; else echo logged-out; fi ;;
  login)
    ab open "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fsection.blog.naver.com%2FBlogHome.naver" >/dev/null
    osascript -e 'tell application "Google Chrome for Testing" to activate' >/dev/null 2>&1
    echo "화면의 Google Chrome for Testing 창에서 로그인하세요(로그인 상태 유지 체크)." ;;
  post)
    draft="$1"; [ -f "$draft" ] || { echo "초안 파일 없음: $draft" >&2; exit 2; }
    title="$(sed -n '1p' "$draft")"
    before="$(ab open "$WRITE_URL" >/dev/null 2>&1; ab wait --load networkidle >/dev/null 2>&1; sleep 3; ab snapshot -i -c -d 12 2>/dev/null | grep -o '임시저장된 글 보기, [0-9]*개' | grep -o '[0-9]*')"
    ab find text "닫기" click >/dev/null 2>&1 || true
    click_at $TITLE_X $TITLE_Y; sleep 1
    ab keyboard type "$title" >/dev/null
    click_at $BODY_X $BODY_Y; sleep 1
    # 본문: 3행부터. 표기 규칙(.agents/blog-job-posts/style.md §1):
    #   "## 제목"      → 소제목 서식으로 한 줄
    #   "> 문장"       → 연속된 > 행을 프레임 인용구 박스 하나에 (탈출: ArrowDown×3 + Enter)
    #   "**문장**"     → 한 줄 전체 굵게(Cmd+B 토글)
    #   빈 행          → Enter 한 번(여러 빈 행 = 여러 번)
    #   그 외          → 본문 한 문단
    inbox=0
    tail -n +3 "$draft" | while IFS= read -r line; do
      case "$line" in
        "> "*|">")
          if [ $inbox -eq 0 ]; then
            r="$(ab snapshot -i -c -d 16 2>/dev/null | grep 'button "인용구 선택"' | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"; ab click "@$r" >/dev/null 2>&1; sleep 0.5
            r="$(ab snapshot -i -c -d 16 2>/dev/null | grep 'button "인용구 6"' | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"; ab click "@$r" >/dev/null 2>&1; sleep 0.5
            inbox=1
          else
            ab press Enter >/dev/null
          fi
          [ -n "${line#> }" ] && ab keyboard type "${line#> }" >/dev/null ;;
        *)
          if [ $inbox -eq 1 ]; then
            ab press ArrowDown >/dev/null; ab press ArrowDown >/dev/null; ab press ArrowDown >/dev/null; ab press Enter >/dev/null; inbox=0
          fi
          case "$line" in
            "## "*)
              setstyle "소제목"; ab keyboard type "${line#\#\# }" >/dev/null; ab press Enter >/dev/null; setstyle "본문" ;;
            "**"*"**")
              ab press Meta+b >/dev/null; t="${line#\*\*}"; ab keyboard type "${t%\*\*}" >/dev/null; ab press Meta+b >/dev/null; ab press Enter >/dev/null ;;
            "") ab press Enter >/dev/null ;;
            *) ab keyboard type "$line" >/dev/null; ab press Enter >/dev/null ;;
          esac ;;
      esac
    done
    sleep 1
    saveref="$(ab snapshot -i -c -d 12 2>/dev/null | grep 'button "저장" \[ref=' | head -1 | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"
    [ -n "$saveref" ] && ab click "@$saveref" >/dev/null 2>&1
    sleep 4
    after="$(ab snapshot -i -c -d 12 2>/dev/null | grep -o '임시저장된 글 보기, [0-9]*개' | grep -o '[0-9]*')"
    echo "임시저장 수: ${before:-?} -> ${after:-?}"
    [ -n "$before" ] && [ -n "$after" ] && [ "$after" -gt "$before" ] && echo saved || { echo not-saved >&2; exit 1; } ;;
  screenshot) ab screenshot "$1" ;;
  reset) ab close --all >/dev/null 2>&1; pkill -f agent-browser-darwin >/dev/null 2>&1; echo reset ;;
  ab) ab "$@" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
