import { query } from '@/lib/neon'

let initialized = false
let initPromise: Promise<void> | null = null

export async function initializeDatabase(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR UNIQUE NOT NULL,
        name VARCHAR NOT NULL,
        password VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS brand_assets (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        asset_type VARCHAR NOT NULL,
        keywords TEXT[] DEFAULT '{}',
        text_content TEXT,
        official_domains TEXT[] DEFAULT '{}',
        file_name VARCHAR,
        file_path VARCHAR,
        file_mime_type VARCHAR,
        file_size INTEGER,
        file_hash VARCHAR,
        perceptual_hash VARCHAR,
        audio_metadata JSONB,
        status VARCHAR DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`ALTER TABLE brand_assets ADD COLUMN IF NOT EXISTS perceptual_hash VARCHAR`)
    await query(`ALTER TABLE brand_assets ADD COLUMN IF NOT EXISTS audio_metadata JSONB`)

    await query(`
      CREATE TABLE IF NOT EXISTS scan_runs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        trigger VARCHAR NOT NULL,
        status VARCHAR NOT NULL,
        asset_ids INTEGER[] DEFAULT '{}',
        platform_status JSONB DEFAULT '[]'::jsonb,
        error_summary JSONB DEFAULT '{}'::jsonb,
        findings_count INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT NOW(),
        finished_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS findings_count INTEGER DEFAULT 0`)

    await query(`
      CREATE TABLE IF NOT EXISTS findings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        scan_run_id INTEGER NOT NULL,
        asset_id INTEGER NOT NULL,
        platform VARCHAR NOT NULL,
        source VARCHAR NOT NULL,
        external_id VARCHAR NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT NOT NULL,
        author JSONB,
        risk_score INTEGER NOT NULL,
        reasons JSONB DEFAULT '[]'::jsonb,
        status VARCHAR DEFAULT 'new',
        published_at TIMESTAMP,
        found_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS evidence_items (
        id SERIAL PRIMARY KEY,
        finding_id INTEGER NOT NULL,
        evidence_type VARCHAR NOT NULL,
        excerpt TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        thumbnail_url TEXT,
        file_hash VARCHAR,
        fetched_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id VARCHAR PRIMARY KEY,
        api_keys JSONB DEFAULT '{}'::jsonb,
        preferences JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        message TEXT,
        payload JSONB DEFAULT '{}'::jsonb,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Tài sản "ad-hoc": findings.asset_id là NOT NULL và unique index upsert
    // gồm asset_id, nên quét một URL lạ không có gì để gắn vào — đó là lý do
    // quét nhanh trước đây không lưu được kết quả. Cho asset_id nullable sẽ
    // ngầm phá unique index (Postgres coi các NULL là khác nhau → findings
    // nhân bản vô hạn), nên thay vào đó tự tạo một asset đánh dấu origin.
    await query(`ALTER TABLE brand_assets ADD COLUMN IF NOT EXISTS origin VARCHAR DEFAULT 'user'`)
    await query(`ALTER TABLE brand_assets ADD COLUMN IF NOT EXISTS source_url TEXT`)
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_assets_source
      ON brand_assets(user_id, source_url) WHERE source_url IS NOT NULL
    `)

    await query(`CREATE INDEX IF NOT EXISTS idx_brand_assets_user_id ON brand_assets(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_scan_runs_user_id ON scan_runs(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_findings_user_id ON findings(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_findings_asset_id ON findings(asset_id)`)
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_unique_source ON findings(user_id, asset_id, platform, external_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_evidence_items_finding_id ON evidence_items(finding_id)`)
    // Không có unique key thì mỗi lần quét lại chèn thêm một hàng evidence
    // trùng lặp vĩnh viễn. Dọn trùng trước rồi mới tạo index.
    await query(`
      DELETE FROM evidence_items e
      USING evidence_items dup
      WHERE e.finding_id = dup.finding_id
        AND e.evidence_type = dup.evidence_type
        AND e.id < dup.id
    `)
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_unique ON evidence_items(finding_id, evidence_type)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC)`)

    await query(`
      CREATE TABLE IF NOT EXISTS extension_api_keys (
        key_hash VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_extension_api_keys_user_id ON extension_api_keys(user_id)`)

    // Đếm quota API bên thứ ba đã tiêu theo từng user, từng ngày (UTC).
    await query(`
      CREATE TABLE IF NOT EXISTS api_usage (
        user_id VARCHAR NOT NULL,
        provider VARCHAR NOT NULL,
        usage_date DATE NOT NULL,
        units INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, provider, usage_date)
      )
    `)

    initialized = true
  })()

  try {
    await initPromise
  } finally {
    initPromise = null
  }
}
