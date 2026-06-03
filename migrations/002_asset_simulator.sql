-- ============================================================================
-- 002_asset_simulator.sql
-- 자산/노후 시뮬레이터 (탭 2) — 시나리오 + 실버타운 등급 프리셋
-- 의존: 001_init.sql 의 pgcrypto, set_updated_at()
-- 멱등성: create table if not exists, on conflict do update
-- ============================================================================

-- 안전망: 001 미적용 환경에서도 동작하도록 의존 객체 보장
create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 1) 실버타운 등급 프리셋
-- ---------------------------------------------------------------------------
create table if not exists silver_town_tiers (
  id                text          primary key,                    -- 'top' / 'high' / 'mid' / 'low'
  label             text          not null,                       -- 표시명
  deposit_base      numeric(15,2) not null,                       -- 보증금 (만원, 2026 기준)
  monthly_cost_base numeric(10,2) not null,                       -- 월생활비 (부부, 만원)
  refundable        boolean       not null default true,
  notes             text,
  display_order     integer       not null default 0,
  updated_at        timestamptz   not null default now()
);

drop trigger if exists silver_town_tiers_set_updated_at on silver_town_tiers;
create trigger silver_town_tiers_set_updated_at
before update on silver_town_tiers
for each row execute function set_updated_at();

-- 등급 대표값: 2026 리서치(부부 2인, 반환형) 기준. 근거: docs/silver-town-research.md
insert into silver_town_tiers (id, label, deposit_base, monthly_cost_base, refundable, notes, display_order) values
  ('top',  '최상급', 100000, 450, true, '더클래식500·VL르웨스트·삼성노블 대형. 호텔식 풀서비스 (보증금 8~12억, 월 350~500만).', 1),
  ('high', '상급',   55000,  350, true, '삼성노블 중형·더시그넘하우스·서울시니어스 대형 (보증금 4~7억, 월 280~400만).',        2),
  ('mid',  '중급',   30000,  250, true, '노블레스타워·마리스텔라·서울시니어스 중형 (보증금 2.5~4억, 월 200~280만).',          3),
  ('low',  '하급',   20000,  180, true, '스프링카운티자이·사이언스빌리지 등 도심소형/비수도권 (보증금 1.5~2.5억, 월 150~200만).', 4)
on conflict (id) do update set
  label             = excluded.label,
  deposit_base      = excluded.deposit_base,
  monthly_cost_base = excluded.monthly_cost_base,
  refundable        = excluded.refundable,
  notes             = excluded.notes,
  display_order     = excluded.display_order;

-- ---------------------------------------------------------------------------
-- 2) 자산 시나리오
-- ---------------------------------------------------------------------------
create table if not exists asset_scenarios (
  id                          uuid          primary key default gen_random_uuid(),
  name                        text          not null,
  description                 text,
  is_default                  boolean       not null default false,

  -- 프로필 -----------------------------------------------------------------
  base_year                   integer       not null default 2026,
  wife_age                    integer       not null default 28,
  husband_age                 integer       not null default 33,
  entry_age                   integer       not null default 75,
  stay_years                  integer       not null default 10,

  -- 자산 ------------------------------------------------------------------
  cash_current                numeric(15,2) not null default 0,         -- 만원
  investment_current          numeric(15,2) not null default 0,
  real_estate_current         numeric(15,2) not null default 0,
  has_real_estate             boolean       not null default false,
  sell_mode                   text          not null default 'at_entry',  -- 'at_entry' | 'keep' | 'custom'
  sell_year_custom            integer,
  re_sell_cost_rate           numeric(5,4)  not null default 0.0400,

  -- 소득 ------------------------------------------------------------------
  wife_income                 numeric(15,2) not null default 5800,       -- 세전 연봉 (만원)
  husband_income              numeric(15,2) not null default 5600,
  income_start_year           integer       not null default 2021,
  net_factor                  numeric(5,4)  not null default 0.8300,
  income_growth_rate          numeric(5,4)  not null default 0.0400,
  income_peak_age             integer       not null default 55,
  income_peak_flat            boolean       not null default true,

  -- 실버타운 --------------------------------------------------------------
  tier_id                     text          not null default 'mid' references silver_town_tiers(id) on delete restrict,
  deposit_override            numeric(15,2),
  monthly_cost_override       numeric(10,2),
  refundable                  boolean       not null default true,
  medical_premium_rate        numeric(5,4)  not null default 0.0150,

  -- 시뮬레이션 가정 -------------------------------------------------------
  inflation_rate              numeric(5,4)  not null default 0.0300,
  investment_return           numeric(5,4)  not null default 0.0600,
  cash_return                 numeric(5,4)  not null default 0.0250,
  real_estate_return          numeric(5,4)  not null default 0.0300,
  savings_rate                numeric(5,4)  not null default 0.3000,
  savings_alloc_cash          numeric(5,4)  not null default 0.3000,
  in_residence_real_return    numeric(5,4)  not null default 0.0100,

  -- 은퇴 / 연금 -----------------------------------------------------------
  retire_age_wife             integer       not null default 60,
  retire_age_husband          integer       not null default 60,
  pension_start_age           integer       not null default 65,
  pension_auto                boolean       not null default true,
  pension_monthly_override    numeric(10,2),

  -- 버퍼 ------------------------------------------------------------------
  medical_buffer_today        numeric(10,2) not null default 20000,      -- 만원 (today's value, 2억)

  -- 메타 ------------------------------------------------------------------
  computed_snapshot           jsonb,
  custom_inputs               jsonb         not null default '{}'::jsonb,

  created_at                  timestamptz   not null default now(),
  updated_at                  timestamptz   not null default now(),

  -- 체크 제약 (앱 레벨 검증 보조용; 너무 엄격하면 추후 확장 곤란 → 최소만)
  constraint asset_scenarios_sell_mode_valid
    check (sell_mode in ('at_entry', 'keep', 'custom')),
  constraint asset_scenarios_stay_years_pos
    check (stay_years > 0 and stay_years <= 50),
  constraint asset_scenarios_ages_ordered
    check (entry_age > wife_age and wife_age > 0 and husband_age > 0),
  constraint asset_scenarios_pension_override_when_manual
    check (pension_auto or pension_monthly_override is not null)
);

drop trigger if exists asset_scenarios_set_updated_at on asset_scenarios;
create trigger asset_scenarios_set_updated_at
before update on asset_scenarios
for each row execute function set_updated_at();

-- 인덱스
create index if not exists asset_scenarios_created_at_idx on asset_scenarios (created_at desc);
create unique index if not exists asset_scenarios_one_default_idx
  on asset_scenarios (is_default) where is_default = true;

-- ---------------------------------------------------------------------------
-- 3) 기본 시나리오 시드 (이미 있으면 스킵)
-- ---------------------------------------------------------------------------
insert into asset_scenarios (
  name, description, is_default,
  base_year, wife_age, husband_age, entry_age, stay_years,
  cash_current, investment_current, real_estate_current, has_real_estate, sell_mode,
  wife_income, husband_income, income_start_year,
  tier_id,
  inflation_rate, investment_return, cash_return, real_estate_return,
  savings_rate, savings_alloc_cash, in_residence_real_return,
  retire_age_wife, retire_age_husband, pension_start_age, pension_auto,
  medical_buffer_today
)
select
  '기본 시나리오',
  '와이프 28세 / 남편 33세 / 중급 / 10년 거주 — 사용자 컨텍스트 기본값',
  true,
  2026, 28, 33, 75, 10,
  0, 0, 0, false, 'at_entry',
  5800, 5600, 2021,
  'mid',
  0.0300, 0.0600, 0.0250, 0.0300,
  0.3000, 0.3000, 0.0100,
  60, 60, 65, true,
  20000
where not exists (
  select 1 from asset_scenarios where is_default = true
);

-- ---------------------------------------------------------------------------
-- 확인 쿼리 (마이그레이션 검증용 — 실제 적용 시 주석 처리 또는 별도 실행)
-- ---------------------------------------------------------------------------
-- select id, label, deposit_base, monthly_cost_base from silver_town_tiers order by display_order;
-- select id, name, is_default, tier_id, stay_years from asset_scenarios;

-- ===========================================================================
-- ROLLBACK (필요 시 수동 실행)
-- ===========================================================================
-- drop trigger if exists asset_scenarios_set_updated_at on asset_scenarios;
-- drop trigger if exists silver_town_tiers_set_updated_at on silver_town_tiers;
-- drop index if exists asset_scenarios_one_default_idx;
-- drop index if exists asset_scenarios_created_at_idx;
-- drop table if exists asset_scenarios;
-- drop table if exists silver_town_tiers;
-- 주의: set_updated_at() / pgcrypto 는 001_init.sql 에서도 사용 → 보존
