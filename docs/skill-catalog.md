# 外部技能包选型

本仓库的技能是「工作流与门禁」，具体知识可以配合成熟的外部技能包使用。下表按当前收录的预设组织，新增预设时可照此追加一节；只列许可明确、仍在维护的项目。

> **这里只维护「声明」：来源、版本 pin、许可、安装方式。技能正文不进仓库**，本机挂载方式见 [`external-skills.md`](external-skills.md)。安装前请读一遍 `SKILL.md` 与安装脚本。

## 版本 pin 约定

- 有 release 的用 release tag（下表「版本 pin」列）；无 release 的用**不可变 commit SHA**，并在安装时校验归档 sha256。
- 无 release 的仓库用不可变 commit SHA（下表直接给出，采集于 2026-11-19）；需要更新时再用 `git ls-remote <repo> refs/heads/main` 或 GitHub API `/commits/main` 取新的 40 位 SHA 回填。**不要写 `latest`**，否则不可复现。
- 提供 sha256 资产的 release（如 backendpro）安装时一并校验归档哈希。
- 同一能力只选一个主包；许可为「未声明／不明确」的不进默认预设，只能手动启用。

## 产品设计

| 包 | 用途 | 许可 | 版本 pin | 安装/适配 |
|---|---|---|---|---|
| [one-line-prototype](https://github.com/Sunnyshinnny776/one-line-prototype) | 一句话需求 → PRD + 泳道图 + 可交互原型 + 确认单 | Apache-2.0 | `v0.2.0` | 纯技能 |
| [pm-skills](https://github.com/product-on-purpose/pm-skills) | 68 个产品技能，取 PRD/故事/验收/ADR/Mermaid/pm-critic | Apache-2.0 | `v2.35.1` | 纯技能 |
| [spec-kit](https://github.com/github/spec-kit) | 规格驱动流程与收敛检查（L 级需求） | MIT | `v1.4.2` | CLI + 流程；**manual，不进默认预设** |

## UI 设计

| 包 | 用途 | 许可 | 版本 pin | 安装/适配 |
|---|---|---|---|---|
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 80 种风格、194 套配色、74 组字体配对、194 条行业规则 | MIT | `v2.15.0` | 需 Python 检索脚本 |
| [ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) | DTCG 令牌、52 个组件规格、52 道门禁、2144 套设计系统 | MIT | `v3.1.1` | 需 Node + 浏览器 |
| [accessibility-agents](https://github.com/Community-Access/accessibility-agents) | WCAG 2.2 AA 审计与文档可访问性 | MIT | `v7.1.0` | 需 MCP |
| ~~frontend-design~~ | 反模板化的审美方向（[anthropics/skills](https://github.com/anthropics/skills) 子目录） | **未声明／不明确**（仓库无根 LICENSE、元数据 `license: null`、README 仅笼统提 Apache 2.0 且点名的是文档技能） | `e4bb5d960d87126ff3b3a8af1a104b7db67560ba`（commit，无 tag） | **不进默认预设**；许可未确认前仅手动评估使用 |

## 前端开发

| 包 | 用途 | 许可 | 版本 pin | 安装/适配 |
|---|---|---|---|---|
| [antfu/skills](https://github.com/antfu/skills) | Vue 3 / Nuxt / Pinia / Vitest 的使用规则与最佳实践（由各项目官方文档生成） | MIT | `4a6bb39e7b45e26402eb215393c51ccf5df1ca4c`（commit，无 tag，采集于 2026-11-20） | 纯技能；取 `vue` / `nuxt` / `pinia` / `vitest` 四个 |
| [react-best-practices](https://github.com/vercel-labs/agent-skills) | 按影响排序的 React/Next 性能规则 | 自述 MIT（README），仓库无 LICENSE 文件 | `agent-skills-1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | 纯技能（安装名 `vercel-react-best-practices`） |
| [composition-patterns](https://github.com/vercel-labs/agent-skills) | 复合组件、状态提升、避免布尔 prop | 同上 | 同上（同仓库同 release） | 纯技能 |
| [web-design-guidelines](https://github.com/vercel-labs/agent-skills) | UI 合规审查（同仓库 release 资产） | 同上 | 同上（同仓库同 release） | 纯技能（见下方注意） |
| [playwright skills](https://playwright.dev/agent-cli/skills) | 测试生成/heal/trace/会话 | 未核实（由 `playwright-cli` 分发，非独立 skill 仓库；安装时随 cli 复制） | 随 `playwright-cli` 版本 | 需浏览器，`playwright-cli install --skills`；**manual，不进默认预设** |
| [code-review-skill](https://github.com/awesome-skills/code-review-skill) | 20+ 语言代码审查，含 React/Vue/CSS | MIT | `4850184dfd7765ea7b3c5c4e9b6cf8e0815ee7cb`（commit，无 tag） | 纯技能 |
| [web-quality-skills](https://github.com/addyosmani/web-quality-skills) | Lighthouse/CWV/性能/SEO | MIT（各 `SKILL.md` frontmatter 亦标 `license: MIT`） | `afa8da942115f2961fdbfa80807ea0b232ff6c00`（commit，对应 2.0.0，无 tag） | 需浏览器或 CLI |

> 注意：`web-design-guidelines` 在 `frontend-dev.yaml` 的 `external_skills` 中被引用，但它**不是** `anthropics/skills` 的子目录，而是 `vercel-labs/agent-skills` 的 skill（与该仓库其他前端包同一 release）。
>
> 注意：Vue 生态**没有 vuejs 组织直接发布的官方技能仓库**。`antfu/skills` 由 Vue 核心团队成员 Anthony Fu 维护，内容从 [`vuejs/docs`](https://github.com/vuejs/docs)、[`nuxt/nuxt`](https://github.com/nuxt/nuxt)、[`vuejs/pinia`](https://github.com/vuejs/pinia)、[`vitest-dev/vitest`](https://github.com/vitest-dev/vitest) 生成，属社区产物而非官方发布物；本仓库按「来源可查、许可明确」收录。`vue-router`、`vueuse`、TanStack Query、Zustand、Next.js 工作流暂无同等可靠的独立包，故不预置：由项目级 `.dsh/skills/` 或 `node_modules` 内版本匹配文档补充（Next.js 16.2+ 自带 `node_modules/next/dist/docs/` 与 AGENTS.md 托管指令）。

## 后端开发

| 包 | 用途 | 许可 | 版本 pin | 安装/适配 |
|---|---|---|---|---|
| [backend-pro-max-skill](https://github.com/shashankswe2020-ux/backend-pro-max-skill) | 带来源规则、ADR/design/decide、MCP | MIT | `v0.9.0`（release，附 SHA256SUMS） | 需 Python；PyPI 0.9.0 未发布，须下 release 的 whl |
| [postgres-mcp](https://github.com/crystaldba/postgres-mcp) | schema/执行计划/索引建议/健康检查 | MIT | `v0.3.0`（release） | 需 MCP + 数据库 |
| [dsh-notes-board](https://github.com/scccy/dsh-notes-board) | 决策记录进 git | MIT | `3066ce367b42261b9036b193d9349a25520e57b7`（commit，v0.3.3，无 tag） | DSH 插件 |

## 选型原则

1. **一个能力只选一个主包**，避免两个包都写 PRD、都定义令牌。
2. **优先带机检的包**：能给出「通过/不通过」的，比只给建议的更有价值。
3. **许可不清的不进默认预设**：`未声明／不明确`、`未核实` 的包可以手动启用，但不出现在团队默认配置里（因此 `frontend-design` 已从 `ui-design` 默认预设移除）。
4. **注意上下文成本**：技能目录整体进入系统提示，按角色隔离，每角色常驻 8–12 个。
5. **版本要 pin 且可复现**：见「版本 pin 约定」；升级外部包时更新这里的 ref，并复核许可与安装脚本。

## 核验说明

许可与版本 pin 采集于 **2026-11-19**，`antfu/skills` 补充采集于 **2026-11-20**，来源为 GitHub API（`license` 字段、releases、commits）与仓库 README：

- 许可明确的包直接取 `license` 字段；vercel 三包标注「自述 MIT」是因仓库无独立 LICENSE 文件、仅 README 声明 MIT。
- `frontend-design` 的许可状态为文件级核验结论：仓库无根 LICENSE、元数据 `license: null`、README 措辞为「many skills ... Apache 2.0」且点名的是文档技能，**未覆盖该 skill**。
- `playwright skills` 许可仍标「未核实」：它由 `playwright-cli` 分发而非独立 skill 仓库，未找到单独的许可声明，安装前请自行复核。
- `antfu/skills` 无 tag，ref 取 `main` 的 commit `4a6bb39e7b45e26402eb215393c51ccf5df1ca4c`；仓库 README 与 `LICENSE.md` 均声明 MIT，四个技能的 frontmatter 标注 `author: Anthony Fu` 及其官方文档来源。
- ref 优先取 release tag；无 release 的取 `main` 分支不可变 commit SHA。安装前按 catalog 的 pin 安装并校验（有 sha256 资产的用 `SHA256SUMS` 校验）。
