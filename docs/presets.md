# 预设字段说明

`presets/<id>.yaml` 是声明式清单：描述「这个角色有什么职责、用哪些技能、能碰哪些工具、按什么标准评审、交付什么」。它是配置来源，不是可执行代码。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 必须与文件名一致，lowercase kebab-case |
| `name` | 是 | 展示名 |
| `version` | 否 | 预设自身版本，与仓库 tag 同步维护 |
| `persona` | 是 | 角色人格与边界，写「做什么、不做什么、依据从哪来」 |
| `skills` | 是 | 引用本仓库 `skills/` 下的技能名，不得内联正文 |
| `external_skills` | 否 | 需要额外安装的外部技能包（见 `docs/skill-catalog.md`） |
| `tools` | 否 | 工具白名单：`fs` / `pwsh` / `web` / `jobs` / `todo` / `present` |
| `mcp` | 否 | 需要的 MCP 服务名：`playwright` / `backendpro` / `postgres` |
| `critic` | 否 | 只读评审子代理：`enabled`、`mode: read-only`、`rubric` 维度 |
| `deliverables` | 是 | 产物路径清单，用 `<feature>` / `<service>` 占位 |
| `handoff` | 否 | `to`（下游角色）与 `artifact`（交接物） |

## 最小示例

```yaml
id: my-role
name: 我的角色
version: 0.1.0
persona: |
  你是……
skills:
  - my-skill
tools:
  - fs
deliverables:
  - out/<feature>/
```

## 转成 DSH 预设

DSH 的预设是 `cordis.patch.yml` 里的 `@deepseek-ai/dsh-agent-preset` 行。最小转译方式：

```yaml
- insert:
    - id: preset-my-role
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: my-role
        name: 我的角色
        description: 从 presets/my-role.yaml 生成
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: |
                （把 persona 贴到这里）
          - id: skill-filesystem
            name: '@deepseek-ai/dsh-skill-filesystem'
            config:
              includeDefaultRoots: false
              customSkillDirs:
                - 'G:\dsh-kit\skills'
          - id: tool-skill
            name: '@deepseek-ai/dsh-tool-skill'
          - id: tool-fs
            name: '@deepseek-ai/dsh-tool-fs'
          - id: tool-pwsh
            name: '@deepseek-ai/dsh-tool-pwsh'
          - id: critic
            name: '@deepseek-ai/dsh-tool-subagent'
            config:
              provider: spawn
              toolName: critic
              agentPreset: my-role-critic
```

注意：

- `customSkillDirs` 指向的是**目录**，该目录下每个子目录一个技能；若只想暴露某个角色的技能，用一个只含该技能的目录。
- `critic` 需要另建一个只读预设（`tool-fs` 关掉 write/edit），否则评审者会顺手改文件。
- `persona` 里的「不做什么」比「做什么」更重要，它决定角色边界。

## 校验

`node scripts/validate-skills.mjs` 会检查：`id` 与文件名一致、`skills` 引用的技能存在、`deliverables` 非空、`persona` 非空。CI 用同一脚本。
