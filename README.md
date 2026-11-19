# dsh-kit

**DSH 预设与技能集**：把角色、团队或工作流的预设，连同它们引用的技能，做成可版本化、可校验、可发版的仓库。

本仓库不是代码库，而是「预设 + 技能 + 流程约束」的集合：`skills/` 是技能的唯一真源，`presets/` 只引用技能名、不内联技能内容，CI 校验 frontmatter 与引用完整性，Release Please 按 Conventional Commits 发版。

[![validate](https://github.com/Lixb53/dsh-kit/actions/workflows/validate.yml/badge.svg)](https://github.com/Lixb53/dsh-kit/actions/workflows/validate.yml)

> 当前收录四个角色预设作为**初始集**（产品设计 / UI 设计 / 前端开发 / 后端开发）。仓库不限定预设的数量与形态：新角色、团队预设、评审器（critic）预设、单一工作流预设，都可以按同一套约定加入。

---

## 是什么

| 目录 | 内容 | 规则 |
|---|---|---|
| `skills/<name>/SKILL.md` | 技能（Agent Skills 规范，YAML frontmatter + Markdown 正文） | 一个技能一个目录；`name` 必须与目录名一致，lowercase kebab-case |
| `presets/<name>.yaml` | 预设：职责、引用哪些技能、工具/MCP、评审维度、交付物 | `id` 与文件名一致；只引用技能名，不复制技能正文 |
| `docs/` | 协作模型、技能选型、预设字段说明、排版规范 | 与实现同步更新 |
| `scripts/validate-skills.mjs` | 本地/CI 校验器（零依赖 Node） | 必须通过才能合并 |
| `.github/` | CI、Release Please、Issue/PR 模板 | 模板用于对齐信息，不是形式 |

### 已收录的预设（初始集）

| 预设 | 职责 | 主要交付物 |
|---|---|---|
| `product-design` | 上游定义与对齐：把模糊需求变成可评审的规则、流程与原型 | PRD、泳道流程图、带规则标注的原型、变更影响分析 |
| `ui-design` | 视觉与体验定义：方向卡、设计令牌、组件规范、可访问性 | 方向卡、DTCG 令牌、组件规格、响应式方案、UX 审查报告 |
| `frontend-dev` | 把设计落地为可运行、可维护、可测试的前端代码 | 组件与页面、性能预算报告、E2E 用例、代码审查结论 |
| `backend-dev` | 约束下的有依据方案：架构、数据、接口、可靠性 | ADR、数据模型、API 契约、容量与失败模式分析、迁移方案 |

这四个预设构成「产品 → UI → 前端/后端」的单向交接链，详见 [`docs/architecture.md`](docs/architecture.md)。它是**一个**可用的协作模型，不是仓库的边界；新增预设不必与这四个同构。

### 新增一个预设

```bash
mkdir -p skills/my-skill presets
$EDITOR skills/my-skill/SKILL.md    # name 与目录名一致
$EDITOR presets/my-skill.yaml       # id 与文件名一致，skills 引用上面的技能
node scripts/validate-skills.mjs
```

字段说明见 [`docs/presets.md`](docs/presets.md)。一个预设可以只引用已有技能（组合式），也可以同时带一个新技能；评审器类预设通常只引用技能、并把工具收紧为只读。

---

## 快速开始

### 1. 克隆

```bash
git clone https://github.com/Lixb53/dsh-kit.git
cd dsh-kit
```

### 2. 在 DSH 中挂载技能

在预设的 `cordis.patch.yml` 里，把技能目录指向本仓库：

```yaml
- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    includeDefaultRoots: false
    customSkillDirs:
      - 'G:\dsh-kit\skills'
- id: tool-skill
  name: '@deepseek-ai/dsh-tool-skill'
```

> 一条 `customSkillDirs` 会暴露 `skills/` 下全部技能。若希望每个预设只看到自己的技能，把技能拆到独立子目录，或在各预设里分别指定子目录。

### 3. 选用或新增预设

`presets/*.yaml` 是声明式清单，描述「这个预设该有哪些技能、工具、评审维度和产物」。可直接作为 DSH 预设的配置来源，也可被脚本转成 `cordis.patch.yml`（转译示例见 [`docs/presets.md`](docs/presets.md)）。

---

## 校验

```bash
npm ci
npm test          # = validate + check-render
```

也可以分开跑：

```bash
node scripts/validate-skills.mjs   # 零依赖：frontmatter / 命名 / 引用 / CHANGELOG / 版本
node scripts/check-render.mjs      # 需 js-yaml：渲染结果的 YAML 合法性与只读评审约束
```

校验内容：

- 每个 `skills/*/SKILL.md` 以 `---` 开头，frontmatter 含 `name`、`description`；
- `name` 与目录名一致且为 lowercase kebab-case；
- `description` 非空且不超过 1024 字符；
- 每个 `presets/*.yaml` 的 `id` 与文件名一致，`skills:` 引用的技能全部存在；
- `CHANGELOG.md` 含 `## [Unreleased]`；
- `version.txt` 与 `.release-please-manifest.json` 的版本一致；
- 渲染出的 `cordis.patch.yml` 片段是合法 YAML，每个预设都挂了 `persona` / `skill-filesystem` / `tool-skill`，评审预设的 `tool-fs` 必须只读且不挂 shell。

CI 在 push / PR 到 `main` 时执行同一套检查，失败即阻止合并。

---

## 渲染成 DSH 配置

`presets/*.yaml` 是声明式清单，用脚本渲染成 DSH 可直接加载的 `cordis.patch.yml` 片段：

```bash
node scripts/render-presets.mjs --out cordis.patch.yml
node scripts/render-presets.mjs --only product-design,ui-design   # 只渲染部分
node scripts/render-presets.mjs --no-critic                       # 不生成评审预设
node scripts/render-presets.mjs --skills-dir /abs/path/to/skills  # 指定技能目录
```

每个 `critic.enabled: true` 的预设会自动生成一个对应的 `<id>-critic` 只读评审预设，并接好 `critic` 子代理工具。

---

## 版本与发版

- 提交遵循 **Conventional Commits 1.0**：`feat` / `fix` / `docs` / `refactor` / `chore`，破坏性变更用 `feat!:` 或 `fix!:`。
- 发版交给 **Release Please**：它解析提交、维护 Release PR、更新 `CHANGELOG.md` 与 `version.txt`，合并该 PR 即打 tag。
- 不要手改版本号。

| 版本 | 触发 | 使用者动作 |
|---|---|---|
| patch | 修正技能步骤、文档错字、预设引用路径 | 直接拉最新 |
| minor | 新增技能/预设、给预设增加可选能力 | 读 CHANGELOG 后决定是否启用 |
| major | 删除/重命名技能、修改预设引用契约、改 frontmatter 必填字段 | 必须读迁移说明 |

---

## 贡献

- 人：读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
- AI：读 [`AGENTS.md`](AGENTS.md)——那是每次改仓库都必须遵守的硬约束，短而可执行。

## 许可

[MIT](LICENSE)
