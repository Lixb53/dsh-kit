# Changelog

本文件由 Release Please 维护；人工只需保证 commit 类型正确，并在 `## [Unreleased]` 下补充面向使用者的说明。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 首批四个角色技能：`product-design`、`ui-design`、`frontend-dev`、`backend-dev`。
- 首批四个角色预设：`presets/*.yaml`，只引用技能名，不内联技能内容。
- 零依赖校验器 `scripts/validate-skills.mjs`：校验 SKILL.md frontmatter、技能名与目录一致性、预设引用完整性、CHANGELOG 结构。
- CI：push / PR 到 `main` 时执行校验。
- Release Please 配置与发版工作流。
- Issue / PR 模板、`CONTRIBUTING.md`、`AGENTS.md`、`docs/`。

### Changed

- 无。

### Fixed

- 无。

## [0.1.0] - 2026-11-19

### Added

- 仓库初始化：目录约定、技能与预设骨架、校验与发版流水线。
