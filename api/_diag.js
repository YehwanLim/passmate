// 임시 진단용. 검증 후 삭제한다. 비밀 값은 노출하지 않고 길이/지문만 반환한다.
import crypto from "node:crypto";

export default function handler(req, res) {
  const fp = (v) => (v ? { len: v.length, sha8: crypto.createHash("sha256").update(v).digest("hex").slice(0, 8) } : null);
  const url = process.env.SUPABASE_URL ?? "";
  res.status(200).json({
    supabaseUrlRef: url ? new URL(url).hostname.split(".")[0] : null,
    supabaseUrl: fp(url),
    serviceRoleKey: fp(process.env.SUPABASE_SERVICE_ROLE_KEY),
    databaseUrlLen: (process.env.DATABASE_URL ?? "").length,
    node: process.version,
  });
}
