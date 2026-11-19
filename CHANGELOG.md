# Changelog

本文件由 Release Please 维护已发布版本；`## [Unreleased]` 由人工维护，用于说明尚未发版的变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.1](https://github.com/Lixb53/dsh-kit/compare/v1.0.0...v1.0.1) (2026-11-19)


### Bug Fixes

* **version:** make version.txt the single source and inject it at render time ([0d6ebbc](https://github.com/Lixb53/dsh-kit/commit/0d6ebbcc34fcce58ed08ea3c3f5ebfb2db8836df))

## [1.0.0](https://github.com/Lixb53/dsh-kit/compare/v0.2.0...v1.0.0) (2026-11-19)


### ⚠ BREAKING CHANGES

* **skills:** skill mount paths change from skills/<name> to skills/<group>; re-render cordis.patch.yml before upgrading.

### Features

* **skills:** group skills by visibility so each preset mounts only its own ([59b72a2](https://github.com/Lixb53/dsh-kit/commit/59b72a234cfbb27128776fb5088bafe81b501e47))

## [Unreleased]

### Changed

- 版本号收口到 `version.txt` 单一真源：`package.json` 交由 Release Please 的 `extra-files` 同步，`presets/*.yaml` 不再写 `version`，由渲染器注入当前仓库版本。
- `validate-skills.mjs` 新增三项检查：`package.json` 版本必须等于 `version.txt`；`version.txt` 必须是合法 SemVer；预设文件出现 `version` 字段即失败。

## [0.2.0](https://github.com/Lixb53/dsh-kit/compare/v0.1.0...v0.2.0) (2026-11-19)

### Features

* **scripts:** render presets into DSH cordis patch and verify output ([4a16c40](https://github.com/Lixb53/dsh-kit/commit/4a16c40ede5a9c1da9db8c8595c19a599a443ec2))

## [0.1.0](https://github.com/Lixb53/dsh-kit/releases/tag/v0.1.0) (2026-11-19)

### Added

- 首批四个角色技能：`product-design`、`ui-design`、`frontend-dev`、`backend-dev`。
- 首批四个角色预设：`presets/*.yaml`，只引用技能名，不内联技能内容。
- 零依赖校验器 `scripts/validate-skills.mjs`：SKILL.md frontmatter、技能名与目录一致性、预设引用完整性、CHANGELOG 结构、版本一致性。
- 预设渲染器 `scripts/render-presets.mjs` 与渲染校验器 `scripts/check-render.mjs`。
- `package.json`：`npm run validate` / `npm run render` / `npm run check:render` / `npm test`。
- CI、Release Please、Issue / PR 模板、`CONTRIBUTING.md`、`AGENTS.md`、`docs/`。
