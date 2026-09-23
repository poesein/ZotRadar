# 5.4.1 package audit / 安装包审计

## Scope / 范围

This audit concerns the **local 5.4.1 archives**, not data already present in a user's Zotero profile, earlier local packages, or third-party caches. Publication includes the reviewed XPI, source archive and update manifest. / 本报告覆盖随代码同步发布的 5.4.1 包；不把用户资料、旧包或第三方缓存误称为已清理。

The XPI allowlist is `manifest.json`, `bootstrap.js`, `prefs.js`, `config/`, `content/`, `locale/`, and `web/`. The source archive adds `README.md`, `README_EN.md`, this audit, `updates.json`, the existing MIT LICENSE, and seven regression files. No real database, PDF, log, profile, screenshot, historical scoring report, or private fixture is included.

## Factory configuration / 出厂配置

- One bundled subscription and one bundled scorecard: `protein_design`.
- Two enabled Europe PMC feeds, both referenced by that subscription.
- Empty priority-author list, model API key, easyScholar key, browser token, and other secret defaults.
- Localhost Ollama example only; no private LAN server address.
- The default provider remains local Ollama. Remote presets contain public vendor endpoints only; the custom third-party base URL is blank.
- The former subject-specific configs, source-level fallbacks, and historical validation documents are excluded from public files.

The protein-design example is intentionally public. It is a starter configuration, not a claim that every user shares that interest. Users can replace or extend it without changing the generic scoring pipeline.

## Checks / 核查

`node --test tests/*.test.mjs` enforces the root allowlist, exact bundled card/feed/subscription relationships, blank personal defaults, no database-like artifacts, sensitive-string patterns, generic scoring, pipeline regression checks, and request shapes for Ollama, OpenAI-compatible/DeepSeek, Anthropic, and Gemini adapters. The release process additionally checks JavaScript syntax, JSON parsing, XPI entries, archive hashes, and package/source consistency. Pattern scanning is a safeguard, **not a guarantee against every possible secret**. A manual review also checked the bundled URLs, display names, model defaults, migration fallback, and README content.

Known limitations: no clean-profile Zotero 10 live-install acceptance, real-key test against every remote provider, live Ollama/easyScholar service test, or independent security assessment is claimed. API keys are redacted from status output but remain Zotero preferences rather than operating-system-vault secrets. The optional local API should not be exposed to the network. An upgrade preserves existing user-owned files and preferences; the factory configuration applies cleanly only to a fresh profile.

## Reasoning-only scope

The 5.4.1 delta adds a reasoning-effort setting and provider-specific parameters only; it does not change provider presets, API base URL routing, or add protocol selection. Seven regression files include ten reasoning tests plus the six existing regression entry points. No real credential or user database is included. Tests cover unchanged default requests, gateway routing, native provider mappings, fallback preservation, cache identity, setting validation and connection-test budgets.

## Findings / 结论

The inspected 5.4.1 local package contains no known personal author list, private server address, real user data, or credential. No source scan can prove that a future user configuration is safe to publish; always inspect any new release archive before uploading. / 本次检查的 5.4.1 本地包未发现已知个人作者名单、私有服务器地址、真实用户数据或凭据；如需公开发布仍须重新审计。
