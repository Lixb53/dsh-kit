# dsh-kit

**DSH 预设与技能集**：把角色、团队或工作流的预设，连同它们引用的技能，做成可版本化、可校验、可发版的仓库。

本仓库不是代码库，而是「预设 + 技能 + 流程约束」的集合：`skills/` 是技能的唯一真源，`presets/` 只引用技能名、不内联技能内容，CI 校验 frontmatter 与引用完整性，Release Please 按 Conventional Commits 发版。

[![validate](https://github.com/Lixb53/dsh-kit/actions/workflows/validate.yml/badge.svg)](https://github.com/Lixb53/dsh-kit/actions/workflows/validate.yml)

> 当前收录四个角色预设作为**初始集**（产品设计 / UI 设计 / 前端开发 / 后端开发）。仓库不限定预设的数量与形态：新角色、团队预设、评审器（critic）预设、单一工作流预设，都可以按同一套约定加入。

---

## 是什么

### 目录

```
skills/<group>/<name>/SKILL.md   # 技能：按分组存放，一个技能一个目录
presets/<name>.yaml              # 预设：只引用技能名
external-skills.local.example.yaml  # 外部技能本机挂载配置模板（复制为 .local.yaml 使用，后者不入库）
scripts/                         # 校验 + 渲染
docs/                            # 协作模型、字段说明、选型、排版、外部技能方案
```

| 目录 | 内容 | 规则 |
|---|---|---|
| `skills-manifest.json` | 外部技能的机器可读清单（来源 + 版本 pin） | `npm run skills` 的真源，来自 `docs/skill-catalog.md` |
| `skills/<group>/<name>/SKILL.md` | 技能（Agent Skills 规范，YAML frontmatter + Markdown 正文） | 两级目录：`<group>` 是隔离单元，`<name>` 必须与 frontmatter 的 `name` 一致，lowercase kebab-case |
| `presets/<name>.yaml` | 预设：职责、引用哪些技能、工具/MCP、评审维度、交付物 | `id` 与文件名一致；只引用技能名，不复制技能正文 |
| `scripts/validate-skills.mjs` | 零依赖校验器 | 必须通过才能合并 |
| `scripts/render-presets.mjs` | 预设 → `cordis.patch.yml` 渲染器 | 按预设引用的技能自动算出要挂载的分组 |
| `scripts/check-render.mjs` | 渲染结果校验器 | 校验 YAML、必需插件、只读评审、技能隔离 |
| `docs/` | 协作模型、技能选型、预设字段说明、外部技能方案、中文排版 | 与实现同步更新 |
| `external-skills.local.example.yaml` | 外部技能本机挂载配置模板 | 复制为 `external-skills.local.yaml` 后填本机路径；后者已 gitignore，不入库 |

**为什么按分组存技能**：DSH 的技能根是「一级目录 = 一个技能」，且一条 `customSkillDirs` 会暴露该目录下全部技能。把技能放进 `skills/<group>/` 后，预设只挂载自己用到的分组目录，选中某个预设就只看到该预设的技能，不会看到其他预设的技能。分组是隔离单元，技能名才是引用标识。

当前分组：

| 分组 | 技能 | 主要使用方 |
|---|---|---|
| `product` | `product-design` | `product-design` 预设 |
| `design` | `ui-design` | `ui-design` 预设 |
| `frontend` | `frontend-dev` | `frontend-dev` 预设 |
| `backend` | `backend-dev` | `backend-dev` 预设 |

一个分组可以放多个技能（例如把 `cjk-typography`、`accessibility-review` 都放进 `design`），此时挂载 `design` 的预设会同时看到它们；不想共享就开新分组。

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
mkdir -p skills/<group>/my-skill presets
$EDITOR skills/<group>/my-skill/SKILL.md   # frontmatter 的 name 用 my-skill
$EDITOR presets/my-skill.yaml              # id 与文件名一致，skills: [my-skill]
npm test
```

字段说明见 [`docs/presets.md`](docs/presets.md)。一个预设可以只引用已有技能（组合式），也可以同时带一个新技能；评审器类预设通常只引用技能、并把工具收紧为只读。

---

## 快速开始

外部技能的安装与增删改见 [`docs/skills-manager.md`](docs/skills-manager.md)（`npm run skills -- install/sync/update/remove`）。

### 1. 克隆

```bash
git clone https://github.com/Lixb53/dsh-kit.git
cd dsh-kit
```

### 2. 生成本机 bundle（跨平台、可迁移）

不用手写 `cordis.patch.yml`，也不要把生成物提交进仓库：

```bash
npm ci
npm run install:presets
```

脚本在**本机**渲染，**每个预设生成一个独立 bundle**：`.generated/dsh-role-presets/<预设id>/`（各含 `package.json` + `cordis.patch.yml`，包名 `@local/dsh-preset-<预设id>`）。想装哪个角色就装哪个目录，卸载/升级互不影响；critic 评审预设与它的主预设在同一个 bundle 里（引用不能跨包）。路径由运行时的仓库根推导——不依赖当前工作目录，也不写死 `G:\` 或 `/home`，Windows / macOS / Linux 通用。`.generated/` 与 `cordis.patch.yml` 都已 gitignore。

每个预设的技能挂载长这样（目录由本机 root 推导）：

```yaml
customSkillDirs:
  - '<本机仓库根>/skills/product'   # 只挂 product 分组
```

常用参数：

```bash
node scripts/install-presets.mjs --only product-design,ui-design  # 只生成部分预设的 bundle
node scripts/install-presets.mjs --combined                       # 退回单包：四个预设装进一个 bundle
node scripts/render-presets.mjs --no-critic                       # 不生成评审预设
node scripts/render-presets.mjs --out cordis.patch.yml            # 只渲染 patch（调试用）
```

### 3. 安装到 DSH

把需要的预设的 bundle 目录（如 `.generated/dsh-role-presets/product-design/`）作为 bundle 安装（用 `plugin_manager install_bundle` 或 GUI 插件管理）。每个包名 `@local/dsh-preset-<预设id>`，可单独安装、卸载、升级；四个都要就四个目录都装。

### 4. 换机器 / 换系统

仓库本身不含任何机器专属路径，迁移只需：

```bash
git clone <repo> && cd dsh-kit
npm ci
npm run install:presets
# 把新生成的 .generated/dsh-role-presets/<预设id>/ 逐个装进本机的 DSH profile
```

旧机器上的 bundle 留着无妨；新机器重新生成、重新安装即可。外部技能的本机路径写在 gitignore 的 `external-skills.local.yaml` 里，同样每台机器各配一份。

### 5. 选用预设

`presets/*.yaml` 是声明式清单，描述「这个预设该有哪些技能、工具、评审维度和产物」。字段说明见 [`docs/presets.md`](docs/presets.md)。

`critic.enabled: true` 的预设会自动配对生成一个 `<id>-critic` 只读评审预设（`tool-fs` 关掉 write/edit，不挂 shell），并接好 `critic` 子代理工具。

---

## 校验

```bash
npm ci
npm test          # = validate + check-render
```

也可以分开跑：

```bash
node scripts/validate-skills.mjs   # 零依赖：布局 / frontmatter / 命名 / 引用 / CHANGELOG / 版本
node scripts/check-render.mjs      # 需 js-yaml：渲染结果与技能隔离
```

校验内容：

- 技能位于 `skills/<group>/<name>/SKILL.md`，`name` 与目录名一致且为 lowercase kebab-case；
- `description` 非空且不超过 1024 字符；顶层 `skills/<name>/SKILL.md` 视为错误布局；
- 每个 `presets/*.yaml` 的 `id` 与文件名一致，`skills:` 引用的技能全部存在；
- `CHANGELOG.md` 含 `## [Unreleased]`；
- `version.txt` 与 `.release-please-manifest.json` 的版本一致；
- 渲染出的 `cordis.patch.yml` 片段是合法 YAML，每个预设都挂了 `persona` / `skill-filesystem` / `tool-skill`；
- **技能隔离**：预设只挂载它引用的技能所在分组，挂载无关分组即失败；
- 评审预设的 `tool-fs` 必须只读且不挂 shell，`critic` 引用的预设必须存在。

CI 在 push / PR 到 `main` 时执行同一套检查，失败即阻止合并。

---

## 版本与发版

**版本号只有一个真源：`version.txt`**，由 Release Please 维护。

- 提交遵循 **Conventional Commits 1.0**：`feat` / `fix` / `docs` / `refactor` / `chore`，破坏性变更用 `feat!:` 或 `fix!:`。
- Release Please 解析提交、维护 Release PR、同步 `version.txt`、`.release-please-manifest.json`、`package.json` 与 `CHANGELOG.md`，合并该 PR 即打 tag。
- 不要手改版本号。
- `presets/*.yaml` **不写** `version`：渲染时从 `version.txt` 注入，避免多处漂移。

| 版本 | 触发 | 使用者动作 |
|---|---|---|
| patch | 修正技能步骤、文档错字、预设引用路径 | 直接拉最新 |
| minor | 新增技能/预设、给预设增加可选能力 | 读 CHANGELOG 后决定是否启用 |
| major | 删除/重命名技能、移动技能分组、修改预设引用契约、改 frontmatter 必填字段 | 必须读迁移说明 |

> 调整技能所在分组会改变挂载路径，属于 major 变更。

### 版本一致性

| 文件 | 谁写 | 校验 |
|---|---|---|
| `version.txt` | Release Please | 真源，必须是合法 SemVer |
| `.release-please-manifest.json` | Release Please | 必须等于 `version.txt` |
| `package.json` 的 `version` | Release Please（`extra-files`） | 必须等于 `version.txt` |
| `presets/*.yaml` | 不写 | 出现 `version` 即校验失败 |

---

## 贡献

- 人：读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
- AI：读 [`AGENTS.md`](AGENTS.md)——那是每次改仓库都必须遵守的硬约束，短而可执行。

## 许可

[MIT](LICENSE)
