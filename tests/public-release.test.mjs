import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const json = name => JSON.parse(read(name));
const manifest = json('manifest.json');
const subscriptions = json('config/subscriptions.json').subscriptions;
const feeds = json('config/feeds.json').feeds;
const scorecard = json('config/scorecards/protein_design.json');

assert.equal(manifest.version, '5.2.21');
assert.equal(manifest.applications.zotero.id, 'zotradar@poesein');
assert.equal(subscriptions.length, 1);
assert.equal(subscriptions[0].id, 'protein_design');
assert.equal(subscriptions[0].scorecard, scorecard.id);
assert.equal(subscriptions[0].default, true);
assert.equal(subscriptions[0].enabled, true);
assert.deepEqual(new Set(subscriptions[0].feed_ids), new Set(feeds.map(feed => feed.id)));
assert.equal(feeds.length, 2);
assert.ok(feeds.every(feed => feed.enabled && feed.type === 'europe_pmc_api'));
assert.match(read('prefs.js'), /defaultSubscription", "protein_design"/);
assert.match(read('prefs.js'), /defaultScorecard", "protein_design"/);
assert.match(read('prefs.js'), /priorityAuthors", ""/);
assert.match(read('prefs.js'), /easyScholarKey", ""/);
assert.match(read('content/scripts/settings.js'), /key:'priorityAuthors'[^\n]*default:''/);
assert.match(read('content/scripts/scorecards.js'), /protein_design: 'protein_design.json'/);

const allowedTop = new Set([
  'manifest.json', 'bootstrap.js', 'prefs.js', 'config', 'content', 'locale', 'web',
  'README.md', 'README_EN.md', 'RELEASE_AUDIT.md', 'updates.json', 'tests', 'releases'
]);
for (const name of fs.readdirSync(root)) assert.ok(name === '.git' || allowedTop.has(name), `Unexpected public root entry: ${name}`);
assert.deepEqual(fs.readdirSync(path.join(root, 'tests')).sort(), ['public-release.test.mjs', 'scoring.test.mjs']);
assert.deepEqual(fs.readdirSync(path.join(root, 'config', 'scorecards')).sort(), ['_template.json', 'protein_design.json']);

const sensitive = [
  /(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}/,
  /(?:^|[^A-Za-z])[A-Z]:\\/,
  /(?:sk-|ghp_|github_pat_)[A-Za-z0-9_]{15,}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/
];
const binaryExt = new Set(['.png', '.jpg', '.jpeg', '.ico', '.svg', '.woff', '.woff2']);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['.git', 'releases'].includes(entry.name)) walk(file); continue; }
    assert.ok(!/\.(?:db|sqlite(?:-wal|-shm)?|pdf|xpi|zip|log)$/i.test(entry.name), `Private/binary artifact: ${file}`);
    if (binaryExt.has(path.extname(file).toLowerCase())) continue;
    const body = fs.readFileSync(file, 'utf8');
    for (const pattern of sensitive) assert.ok(!pattern.test(body), `Sensitive pattern ${pattern} in ${file}`);
  }
}
walk(root);
console.log('Public 5.2.21 config, file-scope, and privacy smoke tests: PASS');
