# Changelog

本文件由 Release Please 维护已发布版本；`## [Unreleased]` 由人工维护，用于说明尚未发版的变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.3.0](https://github.com/Lixb53/dsh-kit/compare/v1.2.0...v1.3.0) (2026-11-20)


### Features

* **presets:** 每个预设生成独立 bundle，支持单独安装/卸载 ([#10](https://github.com/Lixb53/dsh-kit/issues/10)) ([09d3a43](https://github.com/Lixb53/dsh-kit/commit/09d3a43916cffb028d3a3888dbe51cd278d2a0a7))
* **scripts:** 用本机 DSH 真实 schema 校验预设插件配置 ([#12](https://github.com/Lixb53/dsh-kit/issues/12)) ([f7a1321](https://github.com/Lixb53/dsh-kit/commit/f7a13215f8a1b9d441e6be33426fee864c2cee9d))


### Bug Fixes

* **presets:** 补齐 tool-todo / tool-fs-search 的必填配置，修复预设挂载失败 ([#11](https://github.com/Lixb53/dsh-kit/issues/11)) ([c81c963](https://github.com/Lixb53/dsh-kit/commit/c81c963d411e45b854c16653abdb077fb8e0e3fd))
* **skills:** 挂载点与下载物分两层，修复预设技能布局错乱 ([#8](https://github.com/Lixb53/dsh-kit/issues/8)) ([0bc3913](https://github.com/Lixb53/dsh-kit/commit/0bc3913b4fa19e152f8078f5cd57b2df0d8e7039))

## [1.2.0](https://github.com/Lixb53/dsh-kit/compare/v1.1.0...v1.2.0) (2026-11-19)


### Features

* **skills:** 外部技能安装与维护脚本（增删改/版本 pin/按角色隔离） ([8b63960](https://github.com/Lixb53/dsh-kit/commit/8b6396043c250bd7f29ec99c6e8c7cee3ea5caab))

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

- `install-presets.mjs` 默认**每个预设生成一个独立 bundle**（`.generated/dsh-role-presets/<预设id>/`，包名 `@local/dsh-preset-<预设id>`）：想装哪个角色就装哪个目录，单独卸载/升级互不影响；critic 与主预设同包（`agentPreset` 引用不能跨 bundle）。`--combined` 保留旧四合一单包形态；`--only` 只重建指定预设的 bundle 目录。bundle 的 `package.json` 版本改为从 `version.txt` 注入（旧版写死 1.0.0）。

### Added

- `scripts/check-plugin-config.mjs`（`npm run check:config`）：用**本机正在运行的 DSH 安装**里每个插件真实的 `Config` schema（schemastery 的 `~standard.validate`，与 Cordis 启动时 `resolveConfig()` 同一条路径）逐行校验渲染出的预设 `config`。补的是 `check-render.mjs` 的结构性盲区——它只看我们自己的渲染结构，看不到上游 schema；而上游把某个字段改成 `.required()` 且不给默认值时，失败只会在**挂载阶段**暴露，表现为「bundle 装好了却在选择器里看不到」。已接入 `npm test`；`install:presets` 在 `$DSH_INSTALL_DIR` 存在时自动串联，校验不通过即中止安装。拿不到安装目录时（如 CI 的 ubuntu runner、普通 node 面对 `app.asar`）跳过并返回 0，打印跳过原因，不阻断流程。
- `docs/presets.md` 增补「校验」章节与「为什么需要 check-plugin-config」，记录失败链路（单行 schema 失败 → 整棵预设 broken → 选择器过滤 broken 预设 → 无可见报错）与 Desktop 下用 `ELECTRON_RUN_AS_NODE=1` 运行的方式。

### Fixed

- 渲染器补齐两处**当前 DSH 版本必填、无默认值**的插件配置，否则整个预设挂载失败、GUI 里直接看不到：`tool-todo` 补 `config.allowParallelInProgress`（缺了 `product-design` 主预设挂载失败），critic 预设的 `tool-fs-search` 补 `config.sampleOverCapGlobResults`（缺了所有 critic 预设挂载失败）。挂载失败的行会被 registry 标记 `broken`，而新任务选择器只渲染 `broken === undefined` 的预设，所以症状是「装了但选择器里没有」；设置页的 Agent 预设分区仍会显示带「加载失败」的卡片。改后需重跑 `install:presets` 并重载预设 bundle。
- `skills-manager.mjs` 挂载布局改为「下载物与挂载点分两层」：旧版把挂载根 `.generated/external-skills/<预设id>/` 与包目录 `.generated/external-skills/<包id>/` 混在同一层，包 id 与预设 id 同名时（如 pm-skills、code-review-skill）会互相覆盖、sync 还会误删包目录，生成的 bundle 挂载的技能集合错乱。现在下载物留在 `.generated/external-skills/<包id>/`（不挂载），挂载点独立到 `.generated/preset-skills/<预设id>/<技能名>/`；`sync` 先算挂载计划并校验（预设不存在、入口缺 SKILL.md、技能重名即中止），通过后整体重建，复制时跳过 `.git` / `.dsh-source.json`，并自动清理旧布局残留。预设清单改从 `presets/*.yaml` 读取，不再硬编码。`doctor` 升级为校验挂载点与计划一致 + 声明漂移警告；`status` 显示每个预设实际挂载的技能。改后需重跑 `skills -- sync` → `install:presets` → 重装 bundle。

### Added

- `scripts/skills-manager.mjs` + `skills-manifest.json` + `npm run skills`：按 `docs/skill-catalog.md` 的 pin 一键安装/更新/删除外部技能，支持 `list/install/update/remove/sync/status/doctor`。下载用 `git fetch` 固定 tag/commit，跨平台；按预设平铺到独立挂载根，保持角色隔离。`sync` 生成 gitignore 的 `external-skills.local.yaml`。
- `docs/skills-manager.md`：外部技能安装与维护指南；README / usage-guide 增补入口。

- `scripts/install-presets.mjs` + `npm run install:presets`：在目标机器上把预设渲染成可迁移、可卸载的本地 bundle（`@local/dsh-role-presets`）；仓库不再保存任何机器专属绝对路径。换机器 / 换 OS 后 clone → `npm ci` → `npm run install:presets` → 重新安装即可。
- `render-presets.mjs` 暴露 `renderPresets()` / `REPO_ROOT` 供其他脚本直接导入；`check-render.mjs` 改为直接调用，避免子进程 `spawn EPERM`。

### Changed

- `main` 分支保护的审批要求调整为 0 approval：GitHub 不允许作者自审，单人仓库的 1 approval 只会逼出 `--admin` 绕过；合入门禁改为「PR + `validate` 检查通过 + 分支同步」。AGENTS.md 的「推送与 PR」段同步更新。
- `AGENTS.md` 增补「推送与 PR」硬约束：`main` 已开启分支保护（禁强推/删除、合入需 1 approval + `validate` 通过 + 分支同步），日常改动一律切分支走 PR、squash 合并；与 `CONTRIBUTING.md` 的 GitHub Flow 对齐。
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
