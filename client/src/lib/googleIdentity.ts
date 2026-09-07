// Google Identity Services(GIS) 로더 + signInWithIdToken용 nonce 유틸.
// 흐름: 원본 nonce는 supabase.auth.signInWithIdToken에, SHA-256 해시는 GIS initialize에 전달한다.

export interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdInitializeConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
}

interface GoogleButtonOptions {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

export interface GoogleAccountsId {
  initialize: (config: GoogleIdInitializeConfig) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
}

// window.google은 Map.tsx가 Google Maps용으로 이미 전역 선언하고 있어
// 여기서는 augmentation 대신 로컬 캐스트로 GIS 네임스페이스에 접근한다.
function getLoadedGoogleId(): GoogleAccountsId | undefined {
  return (
    window as unknown as {
      google?: { accounts?: { id?: GoogleAccountsId } };
    }
  ).google?.accounts?.id;
}

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let gsiScriptPromise: Promise<GoogleAccountsId> | null = null;

/** GIS 스크립트를 한 번만 로드하고 google.accounts.id를 돌려준다. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const existing = getLoadedGoogleId();
  if (existing) {
    return Promise.resolve(existing);
  }
  if (gsiScriptPromise) {
    return gsiScriptPromise;
  }

  gsiScriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const fail = (message: string) => {
      gsiScriptPromise = null;
      reject(new Error(message));
    };

    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const loaded = getLoadedGoogleId();
      if (loaded) {
        resolve(loaded);
      } else {
        fail("Google 로그인 스크립트가 초기화되지 않았습니다.");
      }
    };
    script.onerror = () => {
      script.remove();
      fail("Google 로그인 스크립트를 불러오지 못했습니다.");
    };
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

/** signInWithIdToken 검증용 nonce 쌍을 만든다. */
export async function createSignInNonce(): Promise<{
  nonce: string;
  hashedNonce: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = toHex(bytes);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nonce),
  );
  return { nonce, hashedNonce: toHex(new Uint8Array(digest)) };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
