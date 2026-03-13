const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const STARTER_FAMILY_ORDER = [
  'piano',
  'strings',
  'brass',
  'reed',
  'chromatic percussion',
  'bass',
  'synth',
  'texture'
];

const seedPath = path.resolve(__dirname, '../../src/data/publicSoundCatalogSeed.json');
let catalogDbPromise = null;

function readSeedItems() {
  const payload = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  return Array.isArray(payload) ? payload : [];
}

function normalizeFamilyRank(family) {
  const rank = STARTER_FAMILY_ORDER.indexOf(family);
  return rank === -1 ? 999 : rank;
}

function normalizeText(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function createCatalogDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE catalog_items (
      id TEXT PRIMARY KEY,
      sound_set_id TEXT,
      instrument_id TEXT,
      name TEXT NOT NULL,
      family TEXT NOT NULL,
      base_note TEXT,
      mime_type TEXT NOT NULL,
      sample_path TEXT NOT NULL,
      license TEXT,
      attribution TEXT,
      family_rank INTEGER NOT NULL
    );
    CREATE INDEX idx_catalog_items_family ON catalog_items (family);
    CREATE INDEX idx_catalog_items_rank_name ON catalog_items (family_rank, name);
  `);

  const insert = db.prepare(`
    INSERT INTO catalog_items (
      id,
      sound_set_id,
      instrument_id,
      name,
      family,
      base_note,
      mime_type,
      sample_path,
      license,
      attribution,
      family_rank
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of readSeedItems()) {
    insert.run([
      item.id,
      normalizeText(item.soundSetId),
      normalizeText(item.instrumentId),
      item.name,
      item.family || 'other',
      normalizeText(item.baseNote),
      item.mimeType || 'audio/wav',
      item.samplePath,
      normalizeText(item.license),
      normalizeText(item.attribution),
      normalizeFamilyRank(item.family)
    ]);
  }

  insert.free();
  return db;
}

async function getCatalogDb() {
  if (!catalogDbPromise) {
    catalogDbPromise = createCatalogDb();
  }
  return catalogDbPromise;
}

function mapCatalogRow(row) {
  return {
    id: row.id,
    soundSetId: row.soundSetId || null,
    instrumentId: row.instrumentId || null,
    name: row.name,
    family: row.family,
    baseNote: row.baseNote || null,
    mimeType: row.mimeType || 'audio/wav',
    samplePath: row.samplePath,
    license: row.license || null,
    attribution: row.attribution || null
  };
}

async function listCatalogItems(options = {}) {
  const db = await getCatalogDb();
  const clauses = [];
  const params = {};
  let sql = `
    SELECT
      id,
      sound_set_id AS soundSetId,
      instrument_id AS instrumentId,
      name,
      family,
      base_note AS baseNote,
      mime_type AS mimeType,
      sample_path AS samplePath,
      license,
      attribution
    FROM catalog_items
  `;

  if (typeof options.family === 'string' && options.family.length > 0) {
    clauses.push('family = $family');
    params.$family = options.family;
  }

  if (typeof options.search === 'string' && options.search.length > 0) {
    clauses.push('(LOWER(name) LIKE $search OR LOWER(family) LIKE $search OR LOWER(sound_set_id) LIKE $search)');
    params.$search = `%${options.search.toLowerCase()}%`;
  }

  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }

  sql += ' ORDER BY family_rank ASC, name COLLATE NOCASE ASC';

  if (Number.isFinite(options.limit) && options.limit > 0) {
    sql += ' LIMIT $limit';
    params.$limit = Math.min(Math.trunc(options.limit), 256);
  }

  const stmt = db.prepare(sql);
  if (Object.keys(params).length > 0) {
    stmt.bind(params);
  }

  const items = [];
  while (stmt.step()) {
    items.push(mapCatalogRow(stmt.getAsObject()));
  }
  stmt.free();

  return items;
}

module.exports = {
  listCatalogItems
};
