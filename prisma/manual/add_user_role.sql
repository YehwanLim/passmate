-- =============================================================================
-- Migration: users 테이블에 role 컬럼 추가
-- PassMate Admin Dashboard — Role-based Access Control
--
-- 실행 위치: Supabase 대시보드 → SQL Editor
-- =============================================================================

-- 1. role 컬럼 추가 (기존 사용자는 모두 'user'로 초기화)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- 2. 인덱스 추가 (AdminGuard에서 role 기준 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. RLS Policy: 자신의 role은 본인만 조회 가능
--    (이미 RLS가 활성화된 경우에만 적용)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 자기 자신의 row만 SELECT 허용 (서비스 role key는 모든 row 접근 가능)
-- CREATE POLICY "users_select_own" ON users
--   FOR SELECT USING (auth.uid() = id);

-- 4. 관리자 role 부여 — 실행 전 이메일을 실제 값으로 변경하세요
-- UPDATE users SET role = 'admin' WHERE email = 'your-admin@email.com';

-- =============================================================================
-- 확인 쿼리
-- =============================================================================
-- SELECT id, email, role FROM users ORDER BY created_at DESC LIMIT 20;
