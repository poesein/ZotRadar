# ZotRadar

ZotRadar is a local literature radar for Zotero 10. It fetches new papers from configurable feeds, evaluates their relevance with editable scorecards, computes a reading-priority score, and brings search, review, and feedback into a native Zotero window. [简体中文](README.md)

Current version: **5.2.21**. [Installable XPI](releases/5.2.21/ZotRadar-5.2.21-zotero10.xpi) · [SHA-256](releases/5.2.21/SHA256SUMS.txt) · [source ZIP](releases/5.2.21/ZotRadar-5.2.21-source.zip)

## Features

- **Direction-based subscriptions.** Each direction binds one scorecard and any number of feeds. The factory example is Protein Design, with Europe PMC feeds for published papers and preprints. Directions, feeds, and scorecards can be added or edited in the panel.
- **Evidence-grounded scoring.** The model first extracts the paper's main question, core objects, evidence type and depth, supporting passages, and unknowns. Program logic checks that evidence before assigning DIRECT, CONTEXTUAL, TRANSFERABLE, or OUT_OF_SCOPE relevance and a reading-priority score.
- **Native paper workspace.** Search and filter papers, inspect authors, journals, impact factor/quartile, grade, score, and reasons; multi-select, import to Zotero, mark read, or rescore.
- **Feedback loop.** Confirm or correct scope and strength, edit or revoke feedback, rebuild a preference profile, and roll back profile versions. Feedback-based recalculation can reuse the existing model assessment.
- **Chinese and English UI.** The interface follows Zotero's language. Chinese title translations and the Scope/Topic columns can be toggled. Titles link to PubMed or DOI, and author names link to Google Scholar.
- **Diagnostics.** Inspect model, journal lookup, database, local API, and recent-run status; an explicit legacy-database migration workflow is available.

Scores are reading aids, not guarantees of paper quality. Experimental claims beyond the visible title and abstract must not be inferred from keyword matches; papers with insufficient evidence may remain unrated.

## Requirements and installation

| Component | Requirement |
| --- | --- |
| Zotero | 10.0.x |
| Operating system | A platform supported by Zotero 10; this version was primarily developed on Windows |
| Scoring model | A reachable Ollama server and a JSON-capable model; the local `qwen3:8b` setting is an example default |
| Journal metrics | Optional easyScholar key; missing metrics are never fabricated |

1. Back up the Zotero data directory. Download the XPI above, install it from the Zotero add-ons manager, then fully quit and restart Zotero.
2. In ZotRadar Settings, check the Ollama URL, model, context size, and timeout. The default URL is `http://127.0.0.1:11434`. Remote servers must be configured manually; no model or server credential is bundled.
3. Open the standalone ZotRadar window. Check the System page, then inspect the example feeds on Subscriptions and test a small fetch/scoring batch.
4. To show journal impact factors and quartiles, configure an easyScholar key. Enable scheduled runs only after checking the daily time and per-feed limit.

Upgrades preserve subscriptions, feeds, user scorecards, feedback, and preferences already stored in the Zotero data directory. Installing a new XPI does not reset them. Factory examples apply to a fresh profile or to configuration that has not been customized.

## Typical workflow

1. Select or create a research direction on Subscriptions and bind its feeds and scorecard.
2. Review the scorecard's DIRECT, CONTEXTUAL, TRANSFERABLE, and OUT_OF_SCOPE boundaries. Edit topics, aliases, or exclusions as needed.
3. Run “Fetch and Score Now.” New papers are deduplicated before model analysis; existing regular Zotero items are not imported again.
4. In Papers, filter by grade, scope, read state, or import state; sort by priority, date, or impact factor. Expand a row for the abstract, DOI, evidence, and score breakdown.
5. Submit feedback for an incorrect judgment. Use manual rescore when the model itself should reassess the title and abstract.

Journal metrics are queried from easyScholar and cached locally; unavailable values remain blank. Chinese title translations are generated asynchronously by the configured model and cached. If the model is unavailable, ZotRadar does not present a keyword fallback as a successful score.

## Data and privacy

The installable package contains program files and a public Protein Design example only—not a Zotero library, PDFs, feedback, user configuration, named priority authors, private server address, or credentials. Runtime data stays in the local Zotero data directory; upgrading or uninstalling the add-on is different from deleting that data.

Fetching contacts the configured feeds (Europe PMC in the example). Scoring and title translation send paper titles and abstracts to the configured Ollama service. Optional journal lookups contact easyScholar. Review the data policies before choosing remote services. `/zotradar/api/*` is a localhost compatibility API whose modifying calls require a local token; do not expose the Zotero local API port directly to the public internet.

The System page can explicitly inspect and import a legacy database. The source file is read-only, while destination import uses a transaction and fingerprint to avoid duplicate imports. Back up first and verify the result in a test profile. Do not attach databases, credentials, or unredacted logs to public issues.

## Source and verification

`config/` holds the example subscription, feeds, scorecard, and generic scoring policy. `content/scripts/` implements fetching, scoring, storage, and migration. `content/services/` is shared by the native panel and compatibility API. `content/ui/dashboard/` is the primary native workspace; `web/` is a developer/compatibility page. `updates.json` supplies Zotero's update manifest.

```powershell
node --test tests/*.test.mjs
```

Offline checks cover factory references, generic scoring, file scope, and common sensitive-string patterns. See the [release audit](RELEASE_AUDIT.md). **Version 5.2.21 has not yet passed a clean-profile Zotero 10 installation, live feed, and live model-scoring acceptance test.** Offline tests do not replace that verification. Bug reports should include Zotero/ZotRadar versions, reproduction steps, and redacted errors.

No open-source license is included at present. Public source visibility alone does not grant modification or redistribution rights.
