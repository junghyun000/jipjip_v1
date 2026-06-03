// 임시 마이그레이션 적용 스크립트 (pg 드라이버, --no-save 설치본 사용)
// 사용: node scripts/apply-migration.mjs <sql파일경로>
import { readFileSync } from 'node:fs';
import pkg from 'pg';
const { Pool } = pkg;

const sqlPath = process.argv[2] || 'migrations/002_asset_simulator.sql';

// .env 파싱 (dotenv 없이)
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
if (!m) { console.error('DATABASE_URL not found in .env'); process.exit(1); }
const connectionString = m[1].trim();

const sql = readFileSync(new URL('../' + sqlPath, import.meta.url), 'utf8');

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  console.log(`Applying ${sqlPath} ...`);
  await pool.query(sql); // 파라미터 없는 단일 호출 → simple query protocol, multi-statement 허용
  console.log('OK: migration applied.\n');

  const tiers = await pool.query(
    'select id, label, deposit_base, monthly_cost_base, refundable, display_order from silver_town_tiers order by display_order'
  );
  console.log('silver_town_tiers:');
  console.table(tiers.rows);

  const scen = await pool.query(
    'select name, is_default, tier_id, stay_years, wife_age, husband_age from asset_scenarios order by created_at'
  );
  console.log('\nasset_scenarios:');
  console.table(scen.rows);
} catch (err) {
  console.error('MIGRATION FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
