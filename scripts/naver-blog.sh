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
#
#   AB_DRY=1 scripts/naver-blog.sh post <draft.md>  # 브라우저 없이 파서만 점검(호출을 stderr 로 출력)
set -u
PROFILE="$HOME/.agent-browser-profiles/naver-blog"
SESSION="naver-blog"
AB=(agent-browser --session "$SESSION" --headed --profile "$PROFILE" --idle-timeout 0)
WRITE_URL="https://blog.naver.com/GoBlogWrite.naver"
HOME_URL="https://section.blog.naver.com/BlogHome.naver"
# 편집기 좌표(CSS px, 뷰포트 1200×646 기준). 제목/본문 첫 줄.
TITLE_X=186; TITLE_Y=249; BODY_X=258; BODY_Y=360

# AB_DRY=1 이면 브라우저를 건드리지 않고 호출만 stderr 로 찍는다(파서 점검용).
ab() { [ -n "${AB_DRY:-}" ] && { print -r -- "ab $*" >&2; return 0; }; "${AB[@]}" "$@"; }
click_at() { ab mouse move "$1" "$2" >/dev/null && ab mouse down >/dev/null && ab mouse up >/dev/null; }
# 헤디드 창이 OS 포커스를 잃으면 press·keyboard type 이 조용히 무시된다(ref 클릭은 된다).
# 활성화만으로는 부족하다. 다른 앱이 포커스를 도로 가져가면 keyboard type 이 조용히 무시되므로
# document.hasFocus() 가 true 가 될 때까지 확인하고 재시도한다.
focus_win() {
  local i=0 ok
  [ -n "${AB_DRY:-}" ] && return 0
  while [ $i -lt 5 ]; do
    osascript -e 'tell application "Google Chrome for Testing" to activate' >/dev/null 2>&1
    sleep 0.6
    ok="$(ab eval 'document.hasFocus()' 2>/dev/null | tr -d '"')"
    [ "$ok" = "true" ] && return 0
    i=$((i+1))
  done
  echo "Chrome for Testing 창에 포커스를 잡지 못했습니다(다른 앱이 가져감)." >&2
  return 1
}
# 편집기 안(iframe)에서 JS 를 돌린다. 본문·제목은 접근성 트리에 안 올라와서 snapshot 으로는 못 읽는다.
in_editor() { ab eval "(()=>{const f=[...document.querySelectorAll('iframe')].map(i=>{try{return i.contentDocument}catch(e){return null}}).filter(Boolean);const d=f[0]||document;return $1})()" 2>/dev/null; }
# 굵게 상태를 원하는 값(1|0)으로 맞춘다. Meta+b 는 토글이라 키 하나가 유실되면 그 뒤가 전부 뒤집힌다
# (2026-09-29 실기: 라벨은 보통, 값 줄이 굵게 들어감). 툴바 굵게 버튼의 se-is-selected 로 현재 상태를 읽는다.
bold() {
  local want="$1" i=0 cur
  [ -n "${AB_DRY:-}" ] && { ab press Meta+b >/dev/null; return 0; }
  while [ $i -lt 3 ]; do
    cur="$(in_editor "d.querySelector('.se-bold-toolbar-button')?.classList.contains('se-is-selected')?'1':'0'" | tr -dc '01')"
    [ "$cur" = "$want" ] && return 0
    ab press Meta+b >/dev/null; sleep 0.4
    i=$((i+1))
  done
  echo "굵게 상태를 ${want} 으로 맞추지 못했습니다." >&2
  return 1
}
# 구분선: 툴바 버튼으로 넣는다. 스타일 드롭다운은 마지막 선택을 기억하므로 기본 버튼 한 번이면 된다.
# 스타일은 "구분선 선택" 드롭다운이 기억하므로 "구분선 추가"만 누르면 된다(2026-09-27 확인).
hr() {
  local r
  r="$(ab snapshot -i -c -d 16 2>/dev/null | grep 'button "구분선 추가"' | head -1 | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"
  [ -n "$r" ] || { echo "구분선 버튼 못 찾음" >&2; return 1; }
  ab click "@$r" >/dev/null 2>&1; sleep 0.5
}
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
# 글자 크기를 캐럿 위치의 입력 서식으로 정한다(13|16 등). 드롭다운은 토글이라 닫혀 있을 때만 연다.
# 굵은 라벨/묶음 소제목 줄은 16, 그 뒤는 13 으로 되돌린다(2026-10-03 사용자 요청).
fontsize() {
  local snap r exp
  [ -n "${AB_DRY:-}" ] && { ab fontsize "$1" >/dev/null; return 0; }
  snap="$(ab snapshot -i -c -d 14 2>/dev/null)"
  exp="$(echo "$snap" | grep 'button "글자 크기 변경"' | head -1 | grep -o 'expanded=[a-z]*')"
  if [ "$exp" = "expanded=false" ]; then
    r="$(echo "$snap" | grep 'button "글자 크기 변경"' | head -1 | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"; ab click "@$r" >/dev/null 2>&1; sleep 0.4
  fi
  r="$(ab snapshot -i -c -d 16 2>/dev/null | grep "button \"$1\" \[ref=" | head -1 | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"
  [ -n "$r" ] && ab click "@$r" >/dev/null 2>&1; sleep 0.3
}
# 인용구 박스 탈출. 인용구는 "인용문 + 출처" 두 칸짜리 컴포넌트라, 못 빠져나오면 다음 문단이
# '출처' 칸으로 들어가 버린다. 타이핑 직후 방향키를 바로 누르면 그 키가 유실돼 이 일이 생긴다
# (2026-09-27 실기: 지연 없이 5/5 실패, 타이핑 뒤 0.6s 를 넣으면 3/3 성공).
# 그래서 ① 먼저 쉬고 ② 눌러 보고 ③ 마지막 컴포넌트가 아직 인용구면 한 번 더 시도한다.
quote_escape() {
  local i=0 lastc
  sleep 0.7
  ab press ArrowDown >/dev/null; ab press ArrowDown >/dev/null; ab press ArrowDown >/dev/null; ab press Enter >/dev/null
  [ -n "${AB_DRY:-}" ] && return 0
  while [ $i -lt 2 ]; do
    sleep 0.6
    lastc="$(in_editor "(()=>{const a=[...d.querySelectorAll('.se-component')];return a.length?a[a.length-1].className:''})()")"
    case "$lastc" in *se-quotation*) ;; *) return 0 ;; esac
    ab press ArrowDown >/dev/null; ab press Enter >/dev/null
    i=$((i+1))
  done
  echo "인용구 박스를 빠져나오지 못했습니다. 다음 문단이 '출처' 칸에 들어가므로 멈춥니다." >&2
  return 1
}

cmd="${1:-}"; shift || true
case "$cmd" in
  check-login)
    ab open "$HOME_URL" >/dev/null 2>&1; ab wait --load networkidle >/dev/null 2>&1
    if ab snapshot -i -c -d 12 2>/dev/null | grep -q '"로그아웃"'; then echo logged-in; else echo logged-out; fi ;;
  login)
    ab open "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fsection.blog.naver.com%2FBlogHome.naver" >/dev/null
    focus_win
    echo "화면의 Google Chrome for Testing 창에서 로그인하세요(로그인 상태 유지 체크)." ;;
  post)
    draft="$1"; [ -f "$draft" ] || { echo "초안 파일 없음: $draft" >&2; exit 2; }
    title="$(sed -n '1p' "$draft")"
    # 글쓰기 URL 을 바로 열면 편집기가 직전 문서를 그대로 물고 있다(같은 탭 SPA). 홈을 한 번 거쳐
    # 새로 로드해야 빈 글이 뜬다. 안 그러면 남의 초안에 본문이 덧붙는다(2026-09-27 확인).
    ab open "$HOME_URL" >/dev/null 2>&1; sleep 1
    before="$(ab open "$WRITE_URL" >/dev/null 2>&1; ab wait --load networkidle >/dev/null 2>&1; sleep 3; ab snapshot -i -c -d 12 2>/dev/null | grep -o '임시저장된 글 보기, [0-9]*개' | grep -o '[0-9]*')"
    # "작성 중인 글이 있습니다" 복구 모달. 떠 있으면 키 입력이 전부 막힌다(2026-09-27 확인).
    # 이 모달은 편집기 iframe 안에 있어서 접근성 스냅샷에 안 잡힌다. 반드시 DOM 으로 찾아야 한다.
    # 새 글을 쓰는 중이므로 "취소"로 이어쓰기를 거절한다. 확인을 누르면 남은 내용 위에 덧쓰게 된다.
    if [ -z "${AB_DRY:-}" ]; then
      m="$(in_editor "(()=>{const p=[...d.querySelectorAll('.se-popup-alert')].find(e=>e.offsetParent&&/작성 중인 글/.test(e.innerText));if(!p)return 'none';const b=[...p.querySelectorAll('button,a')].find(x=>/취소/.test(x.innerText));if(!b)return 'nobtn';b.click();return 'cancelled'})()")"
      case "$m" in
        *cancelled*) echo "알림: '작성 중인 글' 복구 모달을 취소했습니다(이어쓰기 안 함)." >&2; sleep 1.5 ;;
        *nobtn*)     echo "복구 모달은 떴는데 취소 버튼을 못 찾았습니다." >&2; exit 6 ;;
      esac
    fi
    ab find text "닫기" click >/dev/null 2>&1 || true
    # 빈 편집기인지 확인한다. 새 글은 제목·본문 플레이스홀더 2개뿐이다.
    # 뭔가 남아 있으면 그 문서에 덧쓰게 되므로 아무것도 하지 않고 멈춘다.
    if [ -z "${AB_DRY:-}" ]; then
      n="$(in_editor "d.querySelectorAll('.se-component').length" | grep -o '[0-9]\+' | head -1)"
      if [ -n "$n" ] && [ "$n" -gt 2 ]; then
        echo "편집기에 이미 글이 열려 있습니다(컴포넌트 ${n}개). 덧쓰지 않고 멈춥니다." >&2
        echo "편집기에서 그 글을 저장하거나 닫은 뒤 다시 실행하세요." >&2
        exit 4
      fi
    fi
    focus_win || exit 3
    click_at $TITLE_X $TITLE_Y; sleep 1
    ab keyboard type "$title" >/dev/null
    # 포커스가 없거나 모달이 떠 있으면 keyboard type 이 exit 0 으로 아무것도 안 한다.
    # 빈 글이 임시저장되는 걸 여기서 막는다. 제목은 DOM 에서 읽는다(접근성 트리엔 없음).
    if [ -z "${AB_DRY:-}" ] && ! in_editor "d.querySelector('.se-documentTitle').innerText" | grep -qF "${title:0:10}"; then
      echo "제목이 안 들어갔습니다(창 포커스·모달 확인 후 재실행)" >&2; exit 3
    fi
    click_at $BODY_X $BODY_Y; sleep 1
    # 본문: 3행부터. 표기 규칙(.agents/blog-job-posts/style.md §1):
    #   "## 제목"      → 소제목 서식으로 한 줄
    #   "---"          → 구분선(툴바 버튼)
    #   "> 문장"       → 연속된 > 행을 프레임 인용구 박스 하나에 (줄 잇기는 Shift+Enter, 탈출은 quote_escape)
    #   "**문장**"     → 한 줄 전체 굵게(Cmd+B 토글)
    #   빈 행          → Enter 한 번(여러 빈 행 = 여러 번)
    #   그 외          → 본문 한 문단
    #   마지막 행 "태그: …" → 본문에 넣지 않고 실행 끝에 출력(발행 창 태그 칸은 사람이 붙여넣는다)
    # 마지막 행 판정은 파이프 바깥에서 한다. while 이 서브셸이라 안에서 잡으면 값이 안 살아 나온다.
    # $( ) 가 끝의 빈 줄을 잘라 주므로 파일 끝 개행이 몇 개든 판정이 같다.
    body="$(tail -n +3 "$draft")"
    tags="$(printf '%s\n' "$body" | tail -n 1)"
    case "$tags" in "태그:"*) body="$(printf '%s\n' "$body" | sed '$d')" ;; *) tags="" ;; esac
    inbox=0
    # 굵은 줄(라벨·묶음 소제목) 앞 빈 줄 수를 맞추려고 직전 상태를 센다.
    # prev: 직전 비지 않은 줄 종류(start|head|hr|text), blanks: 그 뒤 빈 줄 수.
    prev=start; blanks=0; nbig=0
    # 파이프 대신 here-string 을 쓴다. 파이프면 루프가 서브셸이라 안에서 멈춰도 스크립트가 계속 간다.
    while IFS= read -r line; do
      # 큰따옴표는 작은따옴표로 바꿔 넣는다(2026-10-03 사용자 요청: 본문 인용은 전부 ' ').
      line="${line//\"/'}"
      case "$line" in
        "> "*|">")
          if [ $inbox -eq 0 ]; then
            r="$(ab snapshot -i -c -d 16 2>/dev/null | grep 'button "인용구 선택"' | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"; ab click "@$r" >/dev/null 2>&1; sleep 0.5
            r="$(ab snapshot -i -c -d 16 2>/dev/null | grep 'button "인용구 6"' | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"; ab click "@$r" >/dev/null 2>&1; sleep 0.5
            inbox=1
          else
            # 둘째 줄부터는 Shift+Enter. 그냥 Enter 를 누르면 캐럿이 '출처' 칸으로 넘어가
            # 다음 줄이 출처에 들어간다(2026-09-27 실기 확인). 앞 줄 타이핑이 끝나길 기다린다.
            sleep 0.6; ab press Shift+Enter >/dev/null
          fi
          [ -n "${line#> }" ] && ab keyboard type "${line#> }" >/dev/null ;;
        *)
          if [ $inbox -eq 1 ]; then
            quote_escape || exit 7
            inbox=0
          fi
          case "$line" in
            # 소제목은 굵게도 한다(2026-09-27 사용자 요청). 타이핑 직후 키는 유실되므로 굵게 해제 전에 쉰다.
            "## "*)
              setstyle "소제목"; bold 1 || exit 8; ab keyboard type "${line#\#\# }" >/dev/null; sleep 0.6; bold 0 || exit 8; ab press Enter >/dev/null; setstyle "본문" ;;
            # 굵은 줄은 16pt 로 넣고 뒤를 13pt 로 되돌린다. 본문 바로 뒤에 오는 굵은 줄은
            # 앞에 빈 줄을 2개로 맞춘다(소제목 사이 엔터 두 번, 2026-10-03 사용자 요청).
            # ## 소제목·구분선 바로 뒤는 이미 떨어져 있으므로 채우지 않는다.
            "**"*"**")
              if [ "$prev" = text ]; then
                while [ $blanks -lt 2 ]; do ab press Enter >/dev/null; blanks=$((blanks+1)); done
              fi
              fontsize 16; bold 1 || exit 8; t="${line#\*\*}"; ab keyboard type "${t%\*\*}" >/dev/null; sleep 0.6; bold 0 || exit 8; fontsize 13; ab press Enter >/dev/null
              nbig=$((nbig+1)) ;;
            # ✍/💡/🚫 라벨 줄은 크기는 그대로 굵게만(2026-10-03 사용자 요청).
            "✍ "*|"💡 "*|"🚫 "*)
              bold 1 || exit 8; ab keyboard type "$line" >/dev/null; sleep 0.6; bold 0 || exit 8; ab press Enter >/dev/null ;;
            "---") hr ;;
            "") ab press Enter >/dev/null ;;
            *) bold 0 || exit 8; ab keyboard type "$line" >/dev/null; ab press Enter >/dev/null ;;
          esac ;;
      esac
      case "$line" in
        "") blanks=$((blanks+1)) ;;
        "## "*) prev=head; blanks=0 ;;
        "---") prev=hr; blanks=0 ;;
        *) prev=text; blanks=0 ;;
      esac
    done <<< "$body"
    sleep 1
    # 본문이 중간에 끊겼는지 본다. 루프 도중 포커스를 뺏기면 뒷부분이 통째로 비는데,
    # 임시저장 수만 보면 그걸 못 잡는다. 마지막 본문 줄이 들어갔는지 확인하고 아니면 저장하지 않는다.
    if [ -z "${AB_DRY:-}" ]; then
      lastline="$(printf '%s\n' "$body" | grep -v '^\s*$' | grep -v '^---$' | tail -n 1 | sed 's/^[#>*]*[[:space:]]*//' | cut -c1-14)"
      if [ -n "$lastline" ] && ! in_editor "d.body.innerText" | grep -qF "$lastline"; then
        echo "본문이 끝까지 안 들어갔습니다(마지막 줄 '${lastline}' 없음). 저장하지 않고 멈춥니다." >&2
        exit 5
      fi
      # 16pt 가 안 먹어도 글 자체는 멀쩡하므로 저장은 하고 알림만 남긴다.
      got="$(in_editor "d.querySelectorAll('.se-text-paragraph .se-fs16').length" | grep -o '[0-9]\+' | head -1)"
      [ "${got:-0}" -lt "$nbig" ] && echo "알림: 굵은 줄 ${nbig}개 중 16pt 적용 ${got:-0}개. 나머지는 편집기에서 크기를 맞춰야 합니다." >&2
    fi
    saveref="$(ab snapshot -i -c -d 12 2>/dev/null | grep 'button "저장" \[ref=' | head -1 | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"
    [ -n "$saveref" ] && ab click "@$saveref" >/dev/null 2>&1
    sleep 4
    after="$(ab snapshot -i -c -d 12 2>/dev/null | grep -o '임시저장된 글 보기, [0-9]*개' | grep -o '[0-9]*')"
    # 첫 "저장" 클릭이 반영되지 않는 일이 반복됐다(2026-09-29·09-30, 두 번 다 한 번 더 누르니 저장됨).
    # 같은 문서의 저장 버튼을 다시 누르는 것이라 글이 두 번 들어가지 않는다.
    if [ -n "$before" ] && [ -n "$after" ] && [ "$after" -le "$before" ]; then
      saveref="$(ab snapshot -i -c -d 12 2>/dev/null | grep 'button "저장" \[ref=' | head -1 | grep -o 'ref=e[0-9]*' | sed 's/ref=//')"
      [ -n "$saveref" ] && ab click "@$saveref" >/dev/null 2>&1
      sleep 4
      after="$(ab snapshot -i -c -d 12 2>/dev/null | grep -o '임시저장된 글 보기, [0-9]*개' | grep -o '[0-9]*')"
    fi
    echo "임시저장 수: ${before:-?} -> ${after:-?}"
    # 저장 검증보다 먼저 찍는다. 저장이 실패한 판에서 태그 목록이 제일 필요하다(아래 줄은 exit 1 로 끝날 수 있음).
    [ -n "$tags" ] && { echo "발행 창 '태그 편집' 칸에 붙여넣기:"; t="${tags#태그:}"; echo "${t# }"; }
    [ -n "$before" ] && [ -n "$after" ] && [ "$after" -gt "$before" ] && echo saved || { echo not-saved >&2; exit 1; } ;;
  screenshot) ab screenshot "$1" ;;
  reset) ab close --all >/dev/null 2>&1; pkill -f agent-browser-darwin >/dev/null 2>&1; echo reset ;;
  ab) ab "$@" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
