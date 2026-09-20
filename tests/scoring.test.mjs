import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const scoring = JSON.parse(fs.readFileSync(path.join(root, 'config/scoring.json'), 'utf8'));
const ZR = { Config: { scoring }, Utils: { clamp: value => Math.max(0, Math.min(100, Number(value))) } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'content/scripts/scoring.js'), 'utf8'), { ZR });

const model = { scope: 'DIRECT', strength: 'HIGH' };
const correction = { scope: 'CONTEXTUAL', strength: 'MEDIUM' };
const corrected = ZR.Scoring.score(correction, { baselineJudgement: model, journalScore: 90 });
assert.equal(corrected.base_relevance, 95);
assert.equal(corrected.feedback_adjustment, -35);
assert.equal(corrected.personalized_relevance, 60);
assert.equal(corrected.reading_priority, 66);
assert.equal(corrected.grade, 'B');

const unknown = ZR.Scoring.score({ scope: 'UNCERTAIN', strength: null }, { journalScore: 90 });
assert.equal(unknown.reading_priority, null);
assert.equal(unknown.grade, null);
console.log('Generic scoring and correction smoke test: PASS');
