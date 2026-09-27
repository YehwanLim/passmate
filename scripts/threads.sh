#!/bin/zsh
# Threads API 얇은 래퍼. 자격증명은 레포 밖 ~/.claude/threads/credentials.env 에 둔다.
# 토큰·시크릿은 어떤 경우에도 표준출력으로 찍지 않는다(로그·전사 유출 방지).
#
# 사용:
#   scripts/threads.sh auth-url              # 권한 승인 URL 출력(브라우저에 붙여넣고 승인 → 주소창의 code 복사)
#   scripts/threads.sh exchange <code>       # code → 단기토큰 → 장기토큰(60일). 자격증명 파일에 저장
#   scripts/threads.sh refresh               # 장기토큰 갱신(만료 전 아무 때나, 다시 60일)
#   scripts/threads.sh whoami                # 연결 확인. 계정 핸들·글 수 출력
#   scripts/threads.sh recent [개수]         # 최근 글 목록(JSON). 기본 25, 최대 100
#   scripts/threads.sh insights <글ID>       # 글 단위 성과(조회·좋아요·답글 등)
#   scripts/threads.sh api <경로> [curl인자]  # 임의 GET. 예: api /me/threads -d fields=id,text
#
# 발행(공개됨 — THREADS_CONFIRM=1 이 없으면 미리보기만 하고 끝난다):
#   scripts/threads.sh post <파일|-> [부모글ID]      # 미리보기
#   THREADS_CONFIRM=1 scripts/threads.sh post <파일>  # 실제 발행
#   THREADS_CONFIRM=1 scripts/threads.sh chain <파일> # '---' 줄로 나눈 연속 답글 세트
set -u
CRED="$HOME/.claude/threads/credentials.env"
[ -f "$CRED" ] || { echo "자격증명 파일이 없습니다: $CRED" >&2; exit 1; }
set -a; source "$CRED"; set +a
GRAPH="${THREADS_GRAPH_HOST:-https://graph.threads.net}"
SCOPES="threads_basic,threads_content_publish,threads_manage_replies,threads_read_replies,threads_manage_insights"

need() { eval "[ -n \"\${$1:-}\" ]" || { echo "$CRED 의 $1 이 비어 있습니다." >&2; exit 1; }; }
# 자격증명 파일의 한 줄만 제자리에서 갈아끼운다. 값은 출력하지 않는다.
put_cred() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
  awk -v k="$key" -v v="$val" -F= '$1==k{print k "=" v; found=1; next} {print} END{if(!found) print k "=" v}' "$CRED" > "$tmp"
  cat "$tmp" > "$CRED"; chmod 600 "$CRED"; rm -f "$tmp"; trap - EXIT
}
# 실패 응답은 그대로 보여준다(에러 본문에 토큰은 안 담긴다). 성공 시 호출자가 jq 로 뽑는다.
die_on_error() {
  local body="$1"
  print -r -- "$body" | jq -e '.error' >/dev/null 2>&1 && { echo "Threads API 오류:" >&2; print -r -- "$body" | jq . >&2; exit 1; }
  return 0
}

cmd="${1:-}"; [ -n "$cmd" ] && shift
case "$cmd" in
  auth-url)
    need THREADS_APP_ID; need THREADS_REDIRECT_URI
    echo "https://threads.com/oauth/authorize?client_id=${THREADS_APP_ID}&redirect_uri=${THREADS_REDIRECT_URI}&scope=${SCOPES}&response_type=code"
    ;;
  exchange)
    need THREADS_APP_ID; need THREADS_APP_SECRET; need THREADS_REDIRECT_URI
    code="${1:-}"; [ -n "$code" ] || { echo "사용: scripts/threads.sh exchange <code>" >&2; exit 1; }
    code="${code%\#_}"   # 승인 후 주소창의 code 뒤에 붙는 '#_' 를 떼어낸다
    short="$(curl -sS -X POST "https://graph.threads.com/oauth/access_token" \
      -d "client_id=${THREADS_APP_ID}" -d "client_secret=${THREADS_APP_SECRET}" \
      -d "grant_type=authorization_code" -d "redirect_uri=${THREADS_REDIRECT_URI}" -d "code=${code}")"
    die_on_error "$short"
    stok="$(print -r -- "$short" | jq -r '.access_token // empty')"
    [ -n "$stok" ] || { echo "단기 토큰을 받지 못했습니다(응답에 access_token 없음)." >&2; exit 1; }
    long="$(curl -sS -G "${GRAPH}/access_token" \
      --data-urlencode "grant_type=th_exchange_token" \
      --data-urlencode "client_secret=${THREADS_APP_SECRET}" \
      --data-urlencode "access_token=${stok}")"
    die_on_error "$long"
    ltok="$(print -r -- "$long" | jq -r '.access_token // empty')"
    [ -n "$ltok" ] || { echo "장기 토큰을 받지 못했습니다." >&2; exit 1; }
    put_cred THREADS_ACCESS_TOKEN "$ltok"
    put_cred THREADS_TOKEN_REFRESHED "$(date +%Y-%m-%d)"
    echo "장기 토큰 저장 완료(60일). 만료 예정: $(date -v+60d +%Y-%m-%d)"
    ;;
  refresh)
    need THREADS_ACCESS_TOKEN
    r="$(curl -sS -G "${GRAPH}/refresh_access_token" \
      --data-urlencode "grant_type=th_refresh_token" --data-urlencode "access_token=${THREADS_ACCESS_TOKEN}")"
    die_on_error "$r"
    ltok="$(print -r -- "$r" | jq -r '.access_token // empty')"
    [ -n "$ltok" ] || { echo "갱신 응답에 토큰이 없습니다." >&2; exit 1; }
    put_cred THREADS_ACCESS_TOKEN "$ltok"; put_cred THREADS_TOKEN_REFRESHED "$(date +%Y-%m-%d)"
    echo "토큰 갱신 완료. 만료 예정: $(date -v+60d +%Y-%m-%d)"
    ;;
  whoami)
    need THREADS_ACCESS_TOKEN
    r="$(curl -sS -G "${GRAPH}/me" --data-urlencode "fields=id,username,threads_profile_picture_url,threads_biography" \
      -H "Authorization: Bearer ${THREADS_ACCESS_TOKEN}")"
    die_on_error "$r"; print -r -- "$r" | jq '{id, username, bio: .threads_biography}'
    ;;
  recent)
    need THREADS_ACCESS_TOKEN
    n="${1:-25}"
    r="$(curl -sS -G "${GRAPH}/me/threads" \
      --data-urlencode "fields=id,media_type,text,permalink,timestamp,is_quote_post,replied_to,children" \
      --data-urlencode "limit=${n}" -H "Authorization: Bearer ${THREADS_ACCESS_TOKEN}")"
    die_on_error "$r"; print -r -- "$r" | jq .
    ;;
  insights)
    need THREADS_ACCESS_TOKEN
    id="${1:-}"; [ -n "$id" ] || { echo "사용: scripts/threads.sh insights <글ID>" >&2; exit 1; }
    r="$(curl -sS -G "${GRAPH}/${id}/insights" \
      --data-urlencode "metric=views,likes,replies,reposts,quotes,shares" \
      -H "Authorization: Bearer ${THREADS_ACCESS_TOKEN}")"
    die_on_error "$r"; print -r -- "$r" | jq .
    ;;
  api)
    need THREADS_ACCESS_TOKEN
    ep="${1:-}"; [ -n "$ep" ] || { echo "사용: scripts/threads.sh api <경로> [curl 인자]" >&2; exit 1; }
    shift
    curl -sS -G "${GRAPH}${ep}" "$@" -H "Authorization: Bearer ${THREADS_ACCESS_TOKEN}" | jq .
    ;;
  post)
    # 공개 발행. THREADS_CONFIRM=1 이 없으면 미리보기만 하고 끝낸다(오발행 방지).
    need THREADS_ACCESS_TOKEN
    src="${1:-}"; [ -n "$src" ] || { echo "사용: scripts/threads.sh post <파일|-> [부모글ID]" >&2; exit 1; }
    parent="${2:-}"
    body="$([ "$src" = "-" ] && cat || cat "$src")"
    body="${body%$'\n'}"
    chars=$(print -rn -- "$body" | LC_CTYPE=UTF-8 wc -m | tr -d ' '); bytes=$(print -rn -- "$body" | wc -c | tr -d ' ')
    [ "$chars" -gt 500 ] && { echo "500자 제한 초과: ${chars}자" >&2; exit 1; }
    echo "── 발행할 내용 (${chars}자 / ${bytes}바이트)${parent:+  · 답글 대상 $parent} ──"
    print -r -- "$body"; echo "──────────────"
    [ -n "${THREADS_CONFIRM:-}" ] || { echo "미리보기만 했습니다. 실제로 올리려면 THREADS_CONFIRM=1 을 붙이세요." >&2; exit 2; }
    c="$(curl -sS -X POST "${GRAPH}/me/threads" --data-urlencode "media_type=TEXT" \
      --data-urlencode "text=${body}" ${parent:+--data-urlencode "reply_to_id=${parent}"} \
      -H "Authorization: Bearer ${THREADS_ACCESS_TOKEN}")"
    die_on_error "$c"
    cid="$(print -r -- "$c" | jq -r '.id // empty')"
    [ -n "$cid" ] || { echo "컨테이너 생성 실패." >&2; exit 1; }
    sleep "${THREADS_WAIT:-5}"
    p="$(curl -sS -X POST "${GRAPH}/me/threads_publish" --data-urlencode "creation_id=${cid}" \
      -H "Authorization: Bearer ${THREADS_ACCESS_TOKEN}")"
    die_on_error "$p"
    mid="$(print -r -- "$p" | jq -r '.id // empty')"
    [ -n "$mid" ] || { echo "발행 실패." >&2; exit 1; }
    link="$(curl -sS -G "${GRAPH}/${mid}" --data-urlencode "fields=permalink" \
      -H "Authorization: Bearer ${THREADS_ACCESS_TOKEN}" | jq -r '.permalink // empty')"
    echo "발행 완료  id=${mid}${link:+  $link}"
    ;;
  chain)
    # 연속 답글 세트. 파일을 '---' 줄로 나눠 첫 덩어리는 본문, 나머지는 앞 글의 답글로 잇는다.
    # reply_to_id 는 공식 문서에서 확인되지 않았다(과거 사용 기록 기반). 첫 실사용 때 결과를 확인할 것.
    need THREADS_ACCESS_TOKEN
    src="${1:-}"; [ -f "$src" ] || { echo "사용: scripts/threads.sh chain <파일>  ('---' 줄로 구분)" >&2; exit 1; }
    tmpd="$(mktemp -d)"; awk -v d="$tmpd" 'BEGIN{n=1} /^---[[:space:]]*$/{n++; next} {print > (d "/part" n)}' "$src"
    parts=("$tmpd"/part*(N))
    [ ${#parts} -ge 1 ] || { echo "내용이 비었습니다." >&2; rm -rf "$tmpd"; exit 1; }
    if [ -z "${THREADS_CONFIRM:-}" ]; then
      echo "미리보기: 덩어리 ${#parts}개. 첫 덩어리가 본문, 나머지는 차례로 답글로 붙습니다."
      i=1
      for f in "${parts[@]}"; do
        echo; echo "[$i/${#parts}] $([ $i -eq 1 ] && echo 본문 || echo 답글)"
        "$0" post "$f" 2>/dev/null
        i=$((i+1))
      done
      echo; echo "미리보기만 했습니다. 실제로 올리려면 THREADS_CONFIRM=1 을 붙이세요." >&2
      rm -rf "$tmpd"; exit 2
    fi
    echo "덩어리 ${#parts}개를 이어서 올립니다."
    prev=""; i=1
    for f in "${parts[@]}"; do
      if [ -z "$prev" ]; then out="$("$0" post "$f")"; else out="$("$0" post "$f" "$prev")"; fi
      rc=$?; print -r -- "$out"
      [ $rc -eq 0 ] || { echo "[$i/${#parts}] 에서 실패했습니다. 앞 $((i-1))개만 올라갔습니다." >&2; rm -rf "$tmpd"; exit $rc; }
      prev="$(print -r -- "$out" | sed -n 's/.*id=\([0-9]*\).*/\1/p' | tail -1)"
      [ -n "$prev" ] || { echo "방금 올린 글의 ID를 못 읽어서 중단합니다. 앞 $i 개는 올라갔습니다." >&2; rm -rf "$tmpd"; exit 1; }
      i=$((i+1)); sleep 3
    done
    rm -rf "$tmpd"
    ;;
  *)
    sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
