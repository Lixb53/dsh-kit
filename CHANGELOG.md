# Changelog

本文件由 Release Please 维护；人工只需保证 commit 类型正确，并在 `## [Unreleased]` 下补充面向使用者的说明。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.2.0](https://github.com/Lixb53/dsh-kit/compare/v0.1.0...v0.2.0) (2026-11-19)


### Features

* **scripts:** render presets into DSH cordis patch and verify output ([4a16c40](https://github.com/Lixb53/dsh-kit/commit/4a16c40ede5a9c1da9db8c8595c19a599a443ec2))

## [Unreleased]

### Added

- 首批四个角色技能：`product-design`、`ui-design`、`frontend-dev`、`backend-dev`。
- 首批四个角色预设：`presets/*.yaml`，只引用技能名，不内联技能内容。
- 预设 → DSH 配置的渲染器 `scripts/render-presets.mjs`：自动生成主预设与配套只读评审预设。
- 渲染结果校验器 `scripts/check-render.mjs`：YAML 合法性、必需插件、评审预设只读约束、critic 引用有效性。
- 零依赖校验器 `scripts/validate-skills.mjs`：校验 SKILL.md frontmatter、技能名与目录一致性、预设引用完整性、CHANGELOG 结构、版本一致性。
- `package.json`：`npm run validate` / `npm run render` / `npm run check:render` / `npm test`。
- CI：push / PR 到 `main` 时执行校验与渲染检查。
- Release Please 配置与发版工作流。
- Issue / PR 模板、`CONTRIBUTING.md`、`AGENTS.md`、`docs/`。

### Changed

- 无。

### Fixed

- 无。

## [0.1.0] - 2026-11-19

### Added

- 仓库初始化：目录约定、技能与预设骨架、校验与发版流水线。
