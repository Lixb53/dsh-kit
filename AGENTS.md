# AGENTS.md

本文件是 AI 在本仓库工作时的**硬约束**。完整规范见 `CONTRIBUTING.md`；两者冲突时以本文件为准。

## 仓库性质

- 本仓库管理 DSH 角色预设、技能和文档，不是可编译软件。
- `skills/` 是技能的唯一真源；不要在 `.claude/skills/`、`.codex/skills/` 下放副本。
- `presets/` 只引用技能名，**不得内联技能正文或步骤**。

## 新增或修改技能

- 路径：`skills/<name>/SKILL.md`。
- frontmatter 必须包含 `name`、`description`。
- `name` 必须与目录名一致，lowercase kebab-case（如 `frontend-dev`）。
- 正文写「何时用、怎么做、交付什么、怎么验收」，不写空泛原则。
- 一个技能只解决一类任务；需要多阶段时拆成多个技能，用预设编排。

## 修改预设

- 若技能名变化，同步更新 `presets/*.yaml` 中所有引用。
- 预设必须声明 `id`、`name`、`persona`、`skills`、`deliverables`。
- 不得在预设中复制技能内容；只允许引用。

## 提交

- 使用 Conventional Commits：`feat` / `fix` / `docs` / `refactor` / `chore`。
- 破坏性变更用 `feat!:` 或 `fix!:`。
- 一个 commit 只做一件事；不要混「新增技能」与「改 README」。

## 发版

- 不手动改版本号，不发手动 tag。
- 保证 commit 类型正确，Release Please 会生成 Release PR。

## 合并前

- 运行 `npm test`（= `validate-skills.mjs` + `check-render.mjs`），必须 0 错误。
- 改了技能或预设，必须同步 `CHANGELOG.md` 的 `## [Unreleased]`。
- 改了 `presets/*.yaml` 的结构（新增字段或改渲染语义），必须同步 `scripts/render-presets.mjs` 与 `docs/presets.md`。
