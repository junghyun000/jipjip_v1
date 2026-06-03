-- ============================================================================
-- 004_life_events.sql
-- 라이프 이벤트(장례·질병·시장충격) 저장용 jsonb 컬럼 추가
-- 의존: 002_asset_simulator.sql
-- 멱등성: add column if not exists
-- ============================================================================

alter table asset_scenarios
  add column if not exists life_events jsonb not null default '[]'::jsonb;

-- ROLLBACK:
-- alter table asset_scenarios drop column if exists life_events;
