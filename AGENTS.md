# AGENTS.md

本文件是 AI 在本仓库工作时的**硬约束**。完整规范见 `CONTRIBUTING.md`；两者冲突时以本文件为准。

## 仓库性质

- 本仓库管理 DSH 预设、技能和文档，不是可编译软件。
- `skills/` 是技能的唯一真源；不要在 `.claude/skills/`、`.codex/skills/` 下放副本。
- `presets/` 只引用技能名，**不得内联技能正文或步骤**。

## 技能布局（两级目录）

- 路径必须是 `skills/<group>/<name>/SKILL.md`。
- 顶层 `skills/<name>/SKILL.md` 是错误布局，校验会直接失败。
- `<group>` 是 DSH 技能根的隔离单元：一条 `customSkillDirs` 指向分组目录，该目录下所有技能都会被暴露。
- `<name>` 必须与 frontmatter 的 `name` 一致，lowercase kebab-case。
- 选分组的唯一标准是「谁应该看到它」：只给一个预设用的技能，放该预设独占的分组。
- 多预设共用的技能，放一个共享分组并让这些预设都挂载它；不要复制多份。

## 新增或修改技能

- frontmatter 必须包含 `name`、`description`。
- 正文写「何时用、怎么做、交付什么、怎么验收」，不写空泛原则。
- 一个技能只解决一类任务；需要多阶段时拆成多个技能，用预设编排。

## 修改预设

- 若技能名或技能所在分组变化，同步更新 `presets/*.yaml` 中所有引用。
- 预设必须声明 `id`、`name`、`skills`、`deliverables`。
- **默认薄预设**：不写 `persona`，行为全部由 `skills:` 引用的技能提供（技能按需加载）；只有确实需要常驻角色边界时才写 `persona`，且不得把技能正文搬进去。
- 不得在预设中复制技能内容；只允许引用。
- 挂载目录由渲染器按 `skills:` 自动算出，不要手写 `customSkillDirs`。

## 版本

- 版本号只有 `version.txt` 一个真源；不要手改，也不要在别处另写版本。
- `.release-please-manifest.json` 与 `package.json` 的 `version` 由 Release Please 同步。
- `presets/*.yaml` **不写 `version`**：渲染时从 `version.txt` 注入；写了会校验失败。

## 提交

- 使用 Conventional Commits：`feat` / `fix` / `docs` / `refactor` / `chore`。
- 破坏性变更用 `feat!:` 或 `fix!:`（正确写法：`feat(scope)!: 描述`，不是 `feat!(scope):`，后者 Release Please 解析失败）。
- 一个 commit 只做一件事；不要混「新增技能」与「改 README」。

## 发版

- 不手动改版本号，不发手动 tag。
- 保证 commit 类型正确，Release Please 会生成 Release PR，并同步 `version.txt` / manifest / `package.json`。

## 推送与 PR（main 已开启分支保护）

`main` 已开启保护：禁止强推/删除；合入必须走 PR，且 `validate` 检查通过 + 分支与 main 同步。审批数为 0——GitHub 不允许作者自审，单人仓库要求 approval 只会逼出 `--admin` 绕过，门禁形同虚设；真正的把关是 `validate`（= `npm test`）。日常一律走 PR，不要直接 push main。

- 改动前从最新 main 切分支：`git checkout main && git pull && git checkout -b feat/<desc>`（或 `fix/`、`docs/`）。
- 提交后推分支、开 PR：`git push -u origin <branch>` → `gh pr create --fill`。
- 等 `gh pr checks <n> --watch` 出现 `validate pass`，再 `gh pr merge <n> --squash` 合并。
- Release Please 的 Release PR 走同样流程；若它落后 main，先 `gh pr update-branch <n>` 再合并。
- 合并用 squash merge，保持线性历史，CHANGELOG 才干净。

## 合并前

- 运行 `npm test`（= `validate-skills.mjs` + `check-render.mjs`），必须 0 错误。
- 检查渲染结果里每个预设只挂载了自己的分组：
  `node scripts/render-presets.mjs | Select-String "customSkillDirs" -Context 0,1`
- 改了技能或预设，必须同步 `CHANGELOG.md` 的 `## [Unreleased]`。
- 改了 `presets/*.yaml` 的结构（新增字段或改渲染语义），必须同步 `scripts/render-presets.mjs` 与 `docs/presets.md`。
