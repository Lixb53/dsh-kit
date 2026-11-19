# 外部技能包选型

本仓库的角色技能是「工作流与门禁」，具体知识可以配合成熟的外部技能包使用。下表是调研后的推荐组合，不含许可不明或维护停滞的项目。

> 安装方式因工具而异：多数包支持 `npx skills add <owner>/<repo>`，或在 DSH 里用 `customSkillDirs` 直接挂载 `SKILL.md` 目录。安装前请读一遍 `SKILL.md` 与安装脚本。

## 产品设计

| 包 | 用途 | 许可 | 适配 |
|---|---|---|---|
| [one-line-prototype](https://github.com/Sunnyshinnny776/one-line-prototype) | 一句话需求 → PRD + 泳道图 + 可交互原型 + 确认单 | Apache-2.0 | DSH 插件 / 纯技能 |
| [pm-skills](https://github.com/product-on-purpose/pm-skills) | 68 个产品技能，取 PRD/故事/验收/ADR/Mermaid/pm-critic | Apache-2.0 | 纯技能 |
| [spec-kit](https://github.com/github/spec-kit) | 规格驱动流程与收敛检查（L 级需求） | MIT | CLI + 流程 |

## UI 设计

| 包 | 用途 | 许可 | 适配 |
|---|---|---|---|
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 80 种风格、194 套配色、74 组字体配对、194 条行业规则 | MIT | 需 Python 检索脚本 |
| [ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) | DTCG 令牌、52 个组件规格、52 道门禁、2144 套设计系统 | MIT | 需 Node + 浏览器 |
| [accessibility-agents](https://github.com/Community-Access/accessibility-agents) | WCAG 2.2 AA 审计与文档可访问性 | MIT | 需 MCP |
| [frontend-design](https://github.com/anthropics/skills) | 反模板化的审美方向 | 需核实 | 纯技能 |

## 前端开发

| 包 | 用途 | 许可 | 适配 |
|---|---|---|---|
| [vercel react-best-practices](https://github.com/vercel-labs/agent-skills) | 按影响排序的 React/Next 性能规则 | MIT（待核） | 纯技能 |
| [composition-patterns](https://github.com/vercel-labs/agent-skills) | 复合组件、状态提升、避免布尔 prop | MIT（待核） | 纯技能 |
| [playwright skills](https://playwright.dev/agent-cli/skills) | 测试生成/heal/trace/会话 | Apache-2.0 | 需浏览器 |
| [code-review-skill](https://github.com/awesome-skills/code-review-skill) | 20+ 语言代码审查，含 React/Vue/CSS | MIT | 纯技能 |
| [web-quality-skills](https://github.com/addyosmani/web-quality-skills) | Lighthouse/CWV/性能/SEO | MIT | 需浏览器或 CLI |

## 后端开发

| 包 | 用途 | 许可 | 适配 |
|---|---|---|---|
| [backendpro](https://github.com/shashankswe2020-ux/backend-pro-max-skill) | 731 条带来源规则、ADR/design/decide、MCP | MIT | 需 Python |
| [postgres-mcp](https://github.com/crystaldba/postgres-mcp) | schema/执行计划/索引建议/健康检查 | MIT | 需 MCP + 数据库 |
| [dsh-notes-board](https://github.com/scccy/dsh-notes-board) | 决策记录进 git | 未核实 | DSH 插件 |

## 选型原则

1. **一个能力只选一个主包**，避免两个包都写 PRD、都定义令牌。
2. **优先带机检的包**：能给出「通过/不通过」的，比只给建议的更有价值。
3. **许可不清的不进默认预设**：`需核实` 的包可以手动启用，但不出现在团队默认配置里。
4. **注意上下文成本**：技能目录整体进入系统提示，按角色隔离，每角色常驻 8–12 个。
