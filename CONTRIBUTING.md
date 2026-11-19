# 贡献指南

本仓库管理的是「预设 + 技能 + 文档」，不是可编译的软件。因此规范重点在**目录约定、提交语义、frontmatter 校验和版本发布**，而不是构建与测试。

AI 贡献者请优先读 [`AGENTS.md`](AGENTS.md)；本文件是给人看的完整版。

---

## 1. 目录约定：技能与预设各归其位

```
dsh-kit/
├── skills/
│   └── <name>/
│       └── SKILL.md          # 必须，唯一真源
├── presets/
│   └── <name>.yaml           # 角色预设，只引用技能名
├── docs/
├── scripts/
│   └── validate-skills.mjs
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
├── CONTRIBUTING.md
├── AGENTS.md
├── CHANGELOG.md
└── README.md
```

三条硬规则：

1. **一个技能一个目录**，目录内必须有 `SKILL.md`，`name` 与目录名一致。
2. **`presets/` 只做引用**：列出该角色启用的技能名、工具白名单、MCP 开关、评审维度和交付物，**不要把技能内容内联进去**。否则一次技能更新要改四个预设。
3. **只保留一个真源目录**。其他工具（Claude Code、Codex 等）通过符号链接或安装脚本指向 `skills/`，不要复制多份。

### 新增一个技能

```bash
mkdir skills/my-skill
$EDITOR skills/my-skill/SKILL.md
```

`SKILL.md` 最小结构：

```markdown
---
name: my-skill
description: 一句话说明「什么时候用、解决什么问题」，不超过 1024 字符。
---

# 标题

## 何时使用
## 怎么做
## 交付什么
## 怎么验收
```

然后在相关预设的 `skills:` 列表里加上 `my-skill`，并在 `CHANGELOG.md` 的 `## [Unreleased]` 下记一行。

---

## 2. 提交规范：Conventional Commits 1.0

| 类型 | 含义 | 版本影响 |
|---|---|---|
| `feat:` | 新增技能 / 预设 / 功能性文档 | minor |
| `fix:` | 修正技能步骤、预设引用错误、文档事实错误 | patch |
| `docs:` | 纯文档更新 | 不触发 |
| `refactor:` | 重组目录或技能结构，不改变行为 | 不触发 |
| `chore:` | CI、模板、gitignore 等维护 | 不触发 |
| `feat!:` / `fix!:` | 破坏性变更（改名、删除技能、改预设契约） | **major** |

**原子性**：一个 commit 只做一件事。不要混「新增技能」和「改 README」。

示例：

```
feat(skills): add backend-dev SKILL.md
fix(presets): correct frontend-dev skill reference
docs(contributing): add skill validation requirements
feat!(presets): rename product-designer to product-design
```

**合并策略**：推荐 **squash merge**。线性历史下 Release Please 生成的 CHANGELOG 最干净，也避免 PR 内部「先加后删」污染发布日志。

---

## 3. 分支与 PR

使用 **GitHub Flow**，不预置 `develop`：

- `main`：稳定分支，受保护，只通过 PR 合入。
- `feat/<short-desc>`、`fix/<short-desc>`：从 `main` 切出，PR 回 `main`，合并后删除。

只有当协作者增多、确实需要「预发布集成」时，才加 `develop`（`feature/* → develop → main`）。配置资源仓库的变更频率通常撑不起两层长期分支的维护开销。

### PR 必须满足

- [ ] 新增/修改技能：`skills/<name>/SKILL.md` 存在，frontmatter 含 `name`、`description`，`name` 与目录名一致。
- [ ] 预设：若引用的技能名变化，`presets/*.yaml` 已同步，且引用目标存在。
- [ ] `CHANGELOG.md` 的 `## [Unreleased]` 有对应记录（使用 Release Please 时由工具生成，人工只需保证 commit 类型正确）。
- [ ] `node scripts/validate-skills.mjs` 通过（CI 也会跑）。

PR 描述就三行：**改了什么、对应 Issue、是否已更新 CHANGELOG/预设引用**。

---

## 4. CI：校验 frontmatter 与引用

技能仓库最值得上的 CI 不是「跑测试」，而是 **frontmatter 与引用校验**——`SKILL.md` 的 frontmatter 一旦格式错误或缺字段，DSH 就无法发现和加载该技能。

`scripts/validate-skills.mjs` 检查：

- `SKILL.md` 以 `---` 开头，frontmatter 含 `name`、`description`；
- `name` 为 lowercase kebab-case 且与目录名一致；
- `description` 长度 1–1024；
- `presets/*.yaml` 的 `id` 与文件名一致，`skills:` 引用的技能全部存在；
- `CHANGELOG.md` 含 `## [Unreleased]`。

CI 在 `push` 和 `pull_request` 到 `main` 时执行，失败则阻止合并。

---

## 5. 发版：Release Please

版本管理的目标是**让使用者能锁定一个 tag，知道哪些技能和预设是兼容的**。

1. Release Please 解析 Conventional Commits，自动判断下一个版本号（`feat` → minor，`fix` → patch，`!` → major）。
2. 它维护一个 **Release PR**，自动更新 `CHANGELOG.md` 和 `version.txt`。
3. 你只需要在准备好发版时**合并这个 PR**，它就打 tag、创建 GitHub Release。

### 语义化版本在配置资源仓库里的含义

| 版本 | 触发 | 使用者动作 |
|---|---|---|
| **patch** | 修正技能步骤、文档错字、预设引用路径 | 直接拉最新 |
| **minor** | 新增技能/预设、给预设增加可选能力 | 检查 CHANGELOG 后决定是否启用 |
| **major** | 删除/重命名技能、修改预设引用契约、改 frontmatter 必填字段 | 必须读迁移说明，按新版调整本地配置 |

**关键原则**：预设里引用的技能**不写版本号**，只写技能名，由仓库 tag 整体决定兼容集。使用者拉 `v1.3.0`，四个预设和它们引用的所有技能就是经过 CI 校验的同一组快照。某个技能需要破坏性变更时发 major tag，预设同步更新；使用者要么整体升级，要么停在旧 tag，不会出现「预设是新的、技能是旧的」的半坏状态。

---

## 6. Issue / PR 模板

- `.github/ISSUE_TEMPLATE/new-skill.yml`：新增技能/预设，要求填写用途、目标角色、引用了哪些已有能力、是否需要 MCP。
- `.github/ISSUE_TEMPLATE/bug.yml`：修正类，要求填写哪个技能/预设、期望行为、实际行为、复现方式。
- `.github/PULL_REQUEST_TEMPLATE.md`：三行式。

模板的目的不是增加填写负担，而是让贡献者在提交前自己对齐信息。
