-- 커피챗·모의면접 예약. 관리자가 가능한 시간을 슬롯으로 열고, 로그인한 사용자가 하나를 골라 신청한다.
-- 슬롯 상태를 OPEN → BOOKED 로 조건부 갱신해 같은 시간에 두 명이 잡히지 않게 한다.
CREATE TYPE "MentoringSlotStatus" AS ENUM ('OPEN', 'BOOKED', 'CLOSED');
CREATE TYPE "MentoringSessionType" AS ENUM ('RESUME_REVIEW', 'COFFEE_CHAT', 'MOCK_INTERVIEW');
CREATE TYPE "MentoringBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED');

CREATE TABLE mentoring_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL,
  status "MentoringSlotStatus" NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mentoring_slots_starts_at_idx ON mentoring_slots (starts_at);

CREATE TABLE mentoring_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES mentoring_slots(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_type "MentoringSessionType" NOT NULL,
  message TEXT NOT NULL,
  status "MentoringBookingStatus" NOT NULL DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mentoring_bookings_slot_id_idx ON mentoring_bookings (slot_id);
CREATE INDEX mentoring_bookings_user_id_idx ON mentoring_bookings (user_id);

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다.
ALTER TABLE mentoring_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentoring_bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE mentoring_slots FROM anon;
    REVOKE ALL PRIVILEGES ON TABLE mentoring_bookings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE mentoring_slots FROM authenticated;
    REVOKE ALL PRIVILEGES ON TABLE mentoring_bookings FROM authenticated;
  END IF;
END
$$;
