# dsh-kit

**DSH 四角色技能与预设集**：产品设计 / UI 设计 / 前端开发 / 后端开发。

本仓库不是代码库，而是「角色定义 + 技能 + 流程约束」的可版本化集合：`skills/` 是技能的唯一真源，`presets/` 只引用技能名、不内联技能内容，CI 校验 frontmatter 与引用完整性，Release Please 按 Conventional Commits 发版。

[![validate](https://github.com/Lixb53/dsh-kit/actions/workflows/validate.yml/badge.svg)](https://github.com/Lixb53/dsh-kit/actions/workflows/validate.yml)

---

## 是什么

| 目录 | 内容 | 规则 |
|---|---|---|
| `skills/<name>/SKILL.md` | 角色级技能（Agent Skills 规范，YAML frontmatter + Markdown 正文） | 一个技能一个目录；`name` 必须与目录名一致，lowercase kebab-case |
| `presets/<name>.yaml` | 角色预设：职责、引用哪些技能、工具/MCP、评审维度、交付物 | 只引用技能名，不复制技能正文 |
| `docs/` | 角色协作、技能选型、预设字段说明 | 与实现同步更新 |
| `scripts/validate-skills.mjs` | 本地/CI 校验器（零依赖 Node） | 必须通过才能合并 |
| `.github/` | CI、Release Please、Issue/PR 模板 | 模板用于对齐信息，不是形式 |

### 四个角色

| 预设 | 职责 | 主要交付物 |
|---|---|---|
| `product-design` | 上游定义与对齐：把模糊需求变成可评审的规则、流程与原型 | PRD、泳道流程图、带规则标注的原型、变更影响分析 |
| `ui-design` | 视觉与体验定义：方向卡、设计令牌、组件规范、可访问性 | 方向卡、DTCG 令牌、组件规格、响应式方案、UX 审查报告 |
| `frontend-dev` | 把设计落地为可运行、可维护、可测试的前端代码 | 组件与页面、性能预算报告、E2E 用例、代码审查结论 |
| `backend-dev` | 约束下的有依据方案：架构、数据、接口、可靠性 | ADR、数据模型、API 契约、容量与失败模式分析、迁移方案 |

角色之间是**单向交接**：产品 → UI → 前端/后端；每次交接必须带「可验收的产物」，而不是口头结论。详见 [`docs/architecture.md`](docs/architecture.md)。

---

## 快速开始

### 1. 克隆

```bash
git clone https://github.com/Lixb53/dsh-kit.git
cd dsh-kit
```

### 2. 在 DSH 中挂载技能

在对应预设的 `cordis.patch.yml` 里，把技能目录指向本仓库（按角色隔离，互不污染）：

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

> 一条 `customSkillDirs` 会暴露 `skills/` 下全部角色技能。若希望每个预设只看到自己的技能，把四个角色技能拆到独立目录，或按预设分别指定子目录。

### 3. 选用预设

`presets/*.yaml` 是声明式清单，字段说明见 [`docs/presets.md`](docs/presets.md)。它描述「这个角色该有哪些技能、工具、评审维度和产物」，可直接作为 DSH 预设的配置来源，也可被脚本转成 `cordis.patch.yml`。

---

## 校验

```bash
node scripts/validate-skills.mjs
```

校验内容：

- 每个 `skills/*/SKILL.md` 以 `---` 开头，frontmatter 含 `name`、`description`；
- `name` 与目录名一致且为 lowercase kebab-case；
- `description` 非空且不超过 1024 字符；
- 每个 `presets/*.yaml` 的 `id` 与文件名一致，`skills:` 引用的技能全部存在；
- `CHANGELOG.md` 含 `## [Unreleased]`。

CI 在 push / PR 到 `main` 时执行同一脚本，失败即阻止合并。

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
