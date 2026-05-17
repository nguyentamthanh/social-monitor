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
      CREATE TABLE IF NOT EXISTS keywords (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        term VARCHAR NOT NULL,
        platforms TEXT[] NOT NULL,
        status VARCHAR DEFAULT 'active',
        refresh_interval INTEGER DEFAULT 3600000,
        last_fetched_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS mentions (
        id SERIAL PRIMARY KEY,
        keyword_id INTEGER NOT NULL,
        platform VARCHAR NOT NULL,
        external_id VARCHAR NOT NULL,
        author JSONB NOT NULL,
        content TEXT NOT NULL,
        url VARCHAR NOT NULL,
        metrics JSONB NOT NULL,
        published_at TIMESTAMP NOT NULL,
        fetched_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS trend_data (
        id SERIAL PRIMARY KEY,
        keyword_id INTEGER NOT NULL,
        platform VARCHAR NOT NULL,
        date DATE NOT NULL,
        mention_count INTEGER DEFAULT 0,
        engagement INTEGER DEFAULT 0
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

    await query(`CREATE INDEX IF NOT EXISTS idx_mentions_keyword_id ON mentions(keyword_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_mentions_published_at ON mentions(published_at)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_keywords_user_id ON keywords(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_trend_data_keyword_id ON trend_data(keyword_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_brand_assets_user_id ON brand_assets(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_scan_runs_user_id ON scan_runs(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_findings_user_id ON findings(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_findings_asset_id ON findings(asset_id)`)
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_unique_source ON findings(user_id, asset_id, platform, external_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_evidence_items_finding_id ON evidence_items(finding_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC)`)

    initialized = true
  })()

  try {
    await initPromise
  } finally {
    initPromise = null
  }
}
