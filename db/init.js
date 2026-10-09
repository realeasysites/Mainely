const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// DB_PATH should point at a persistent disk in production (e.g. /var/data/mainely.sqlite on Render).
// Without it, leads live inside the deploy and are wiped on every redeploy.

// Columns added after the first version. Existing databases get them added on boot.
const ADDED_COLUMNS = {
  rebate: 'TEXT',
  source_form: 'TEXT',   // 'quick' (hero form) or 'full' (estimate form)
  source_page: 'TEXT',   // page the visitor submitted from
  referrer: 'TEXT',      // where they came from before the site (Google, Facebook…)
  utm_source: 'TEXT',
  utm_medium: 'TEXT',
  utm_campaign: 'TEXT',
  contacted_at: 'TEXT',  // first time the status moved off "new"
};

function initDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'mainely.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!process.env.DB_PATH) {
    console.warn('[db] DB_PATH not set — using a local file. Leads will NOT survive a Render redeploy.');
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      name          TEXT NOT NULL,
      phone         TEXT,
      email         TEXT,
      town          TEXT,
      services      TEXT,
      property_type TEXT,
      timeline      TEXT,
      message       TEXT,
      discount      TEXT,
      status        TEXT NOT NULL DEFAULT 'new',
      notes         TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
  `);

  const have = new Set(db.prepare('PRAGMA table_info(leads)').all().map((c) => c.name));
  for (const [col, type] of Object.entries(ADDED_COLUMNS)) {
    if (!have.has(col)) db.exec(`ALTER TABLE leads ADD COLUMN ${col} ${type}`);
  }
  return db;
}

module.exports = { initDb };
