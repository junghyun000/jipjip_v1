-- ============================================================================
-- 003_real_estate_purchase.sql
-- 부동산 미래 매입 모델 지원 — asset_scenarios 컬럼 3개 추가 + 데이터 이관
-- 의존: 002_asset_simulator.sql
-- 멱등성: add column if not exists, update with where 절
-- ============================================================================

alter table asset_scenarios add column if not exists real_estate_mode             text          not null default 'none';
alter table asset_scenarios add column if not exists real_estate_buy_year         integer;
alter table asset_scenarios add column if not exists real_estate_buy_price_today  numeric(15,2);

-- 기존 데이터 이관: has_real_estate=true → 'owned', false → 'none'
update asset_scenarios
   set real_estate_mode = case when has_real_estate then 'owned' else 'none' end
 where real_estate_mode = 'none' and has_real_estate is not null;

-- 유효값 체크
alter table asset_scenarios drop constraint if exists asset_scenarios_re_mode_valid;
alter table asset_scenarios add constraint asset_scenarios_re_mode_valid
  check (real_estate_mode in ('owned', 'buy_later', 'none'));

-- ROLLBACK:
-- alter table asset_scenarios drop constraint if exists asset_scenarios_re_mode_valid;
-- alter table asset_scenarios drop column if exists real_estate_buy_price_today;
-- alter table asset_scenarios drop column if exists real_estate_buy_year;
-- alter table asset_scenarios drop column if exists real_estate_mode;
