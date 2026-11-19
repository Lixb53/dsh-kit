# Changelog

本文件由 Release Please 维护已发布版本；`## [Unreleased]` 由人工维护，用于说明尚未发版的变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.1.0](https://github.com/Lixb53/dsh-kit/compare/v1.0.1...v1.1.0) (2026-11-19)


### Features

* **skills:** 外部技能清单与安装分离，支持本地挂载与版本 pin ([a23dd1a](https://github.com/Lixb53/dsh-kit/commit/a23dd1a2f14a4bad98f603ab3665f6bb3f27e556))


### Bug Fixes

* **docs:** 修正 presets 最小示例中会被校验拒绝的 version 字段 ([72ddb95](https://github.com/Lixb53/dsh-kit/commit/72ddb95f5fff60912eada34eef35089ad3099c2b))

## [1.0.1](https://github.com/Lixb53/dsh-kit/compare/v1.0.0...v1.0.1) (2026-11-19)


### Bug Fixes

* **version:** make version.txt the single source and inject it at render time ([0d6ebbc](https://github.com/Lixb53/dsh-kit/commit/0d6ebbcc34fcce58ed08ea3c3f5ebfb2db8836df))

## [1.0.0](https://github.com/Lixb53/dsh-kit/compare/v0.2.0...v1.0.0) (2026-11-19)


### ⚠ BREAKING CHANGES

* **skills:** skill mount paths change from skills/<name> to skills/<group>; re-render cordis.patch.yml before upgrading.

### Features

* **skills:** group skills by visibility so each preset mounts only its own ([59b72a2](https://github.com/Lixb53/dsh-kit/commit/59b72a234cfbb27128776fb5088bafe81b501e47))

## [Unreleased]

### Added

- `scripts/install-presets.mjs` + `npm run install:presets`：在目标机器上把预设渲染成可迁移、可卸载的本地 bundle（`@local/dsh-role-presets`）；仓库不再保存任何机器专属绝对路径。换机器 / 换 OS 后 clone → `npm ci` → `npm run install:presets` → 重新安装即可。
- `render-presets.mjs` 暴露 `renderPresets()` / `REPO_ROOT` 供其他脚本直接导入；`check-render.mjs` 改为直接调用，避免子进程 `spawn EPERM`。

### Changed

- 跨机器可移植性：`customSkillDirs` 由运行时的仓库根推导（默认从脚本位置计算，不依赖 cwd / 操作系统），不再把 `G:\dsh-kit\skills\...` 写死进渲染结果；`.generated/` 与 `cordis.patch.yml` 加入 `.gitignore`。

- 四个预设的 `persona` 按 `research/四角色预设提示词-按需critic版` 完善为完整行为契约：范围分级、分阶段工作流、确定性门禁 C0、按需 critic 门禁 C1（默认关闭，仅 T1/T2/T3 命中时跑恰好一次，未触发须显式声明）。
- `frontend-dev` persona 改为框架中立：启动先读项目 AGENTS.md 识别框架/版本，框架技能随项目 `.dsh/skills` 走，预设只维护一份、不预置任何框架技能目录。
- 四个预设的 critic 评审维度与 persona 内 C1 声明对齐；`product-design` / `ui-design` / `frontend-dev` / `backend-dev` 的交付物补齐 review 子目录与确认单路径。

### Added

- `docs/external-skills.md`：外部技能「清单与安装分离」方案——预设声明 + catalog 版本 pin + 本机挂载配置三段式，含可复现安装与挂载步骤。
- `external-skills.local.example.yaml`：本机挂载配置模板，复制为 `external-skills.local.yaml`（已 gitignore）填写即可。
- `render-presets.mjs` 支持可选 `external-skills.local.yaml`（或 `--external-config`），把本机外部技能安装目录并入对应预设的 `customSkillDirs`；校验器对这些目录豁免「无关分组」检查。
- `check-render.mjs` 透传 `--external-config`，保证被校验结果与渲染一致。

### Changed

- 版本号收口到 `version.txt` 单一真源：`package.json` 交由 Release Please 的 `extra-files` 同步，`presets/*.yaml` 不再写 `version`，由渲染器注入当前仓库版本。
- `validate-skills.mjs` 新增三项检查：`package.json` 版本必须等于 `version.txt`；`version.txt` 必须是合法 SemVer；预设文件出现 `version` 字段即失败。
- `skill-catalog.md` 补外部包许可核验结果与版本 pin（无 release 的包用不可变 commit SHA，采集于 2026-11-19）；`frontend-design` 许可不明确，按选型原则从 `ui-design` 默认预设移除（仅手动启用）。

### Fixed

- `docs/presets.md` 最小示例误写 `version: 0.1.0`，照抄会被校验器拒绝；已删除该行。
- 渲染器对「声明了 `external_skills` 但未配置本机挂载」给出 warn，避免"写了就生效"的误解。

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
