# 5.3.1 public release audit / 公开分发审计

## Scope / 范围

This audit concerns the **current 5.3.1 archives and files committed for this release**, not data already present in a user's Zotero profile, earlier local packages, or third-party caches. / 本报告只覆盖当前 5.3.1 发布物；不把用户资料、旧本地包或第三方缓存误称为已清理。

The XPI allowlist is `manifest.json`, `bootstrap.js`, `prefs.js`, `config/`, `content/`, `locale/`, and `web/`. The source archive adds `README.md`, `README_EN.md`, this audit, `updates.json`, and four public regression tests. No real database, PDF, log, profile, screenshot, historical scoring report, or private fixture is included.

## Factory configuration / 出厂配置

- One bundled subscription and one bundled scorecard: `protein_design`.
- Two enabled Europe PMC feeds, both referenced by that subscription.
- Empty priority-author list, easyScholar key, browser token, and other secret defaults.
- Localhost Ollama example only; no private LAN server address.
- The former subject-specific configs, source-level fallbacks, and historical validation documents are excluded from public files.

The protein-design example is intentionally public. It is a starter configuration, not a claim that every user shares that interest. Users can replace or extend it without changing the generic scoring pipeline.

## Checks / 核查

`node --test tests/*.test.mjs` enforces the root allowlist, exact bundled card/feed/subscription relationships, blank personal defaults, no database-like artifacts, sensitive-string patterns, generic scoring, and pipeline regression checks. The release process additionally checks JavaScript syntax, JSON parsing, XPI entries, archive hashes, and package/source consistency. Pattern scanning is a safeguard, **not a guarantee against every possible secret**. A manual review also checked the bundled URLs, display names, model defaults, migration fallback, and README content.

Known limitations: no clean-profile Zotero 10 live-install acceptance, live Ollama/easyScholar service test, or independent security assessment is claimed. The optional local API should not be exposed to the network. An upgrade preserves existing user-owned files and preferences; the factory configuration applies cleanly only to a fresh profile.

## Findings / 结论

The inspected 5.3.1 public file set contains no known personal author list, private server address, real user data, or credential. No source scan can prove that a future user configuration is safe to publish; always inspect any new release archive before uploading. / 本次已检查的公开文件集未发现已知个人作者名单、私有服务器地址、真实用户数据或凭据；今后每次发布仍需重新审计。
