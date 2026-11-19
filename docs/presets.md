# 预设字段说明

`presets/<id>.yaml` 是声明式清单：描述「这个预设有什么职责、用哪些技能、能碰哪些工具、按什么标准评审、交付什么」。它是配置来源，不是可执行代码。

预设不限于「角色」：团队预设、评审器（critic）预设、单一工作流预设都可以用同一套字段描述；区别只在 `persona`、`tools` 与 `mcp` 的收紧程度。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 必须与文件名一致，lowercase kebab-case |
| `name` | 是 | 展示名 |
| `description` | 建议 | 一行说明；渲染成 DSH 预设的 `description`，缺省时从 `persona` 截取 |
| `persona` | 是 | 角色人格与边界，写「做什么、不做什么、依据从哪来」 |
| `skills` | 是 | 引用本仓库 `skills/<group>/<name>/` 下的技能名，不得内联正文；同时决定挂载哪些分组 |
| `external_skills` | 否 | 需要额外安装的外部技能包（见 `docs/skill-catalog.md`） |
| `tools` | 否 | 工具白名单：`fs` / `pwsh` / `web` / `jobs` / `todo` / `present` / `askUser` |
| `mcp` | 否 | 需要的 MCP 服务名：`playwright` / `backendpro` / `postgres` |
| `critic` | 否 | 只读评审子代理：`enabled`、`mode: read-only`、`rubric` 维度 |
| `deliverables` | 是 | 产物路径清单，用 `<feature>` / `<service>` 占位 |
| `handoff` | 否 | `to`（下游预设）与 `artifact`（交接物） |

> **不要写 `version`**。仓库版本只认 `version.txt`，渲染时统一注入到每个预设条目的 `config.version`；预设文件里出现 `version` 会校验失败。

### 版本从哪来

| 文件 | 谁维护 | 说明 |
|---|---|---|
| `version.txt` | Release Please | **唯一真源**，发版时自动递增 |
| `.release-please-manifest.json` | Release Please | 与 `version.txt` 同步 |
| `package.json` | Release Please（`extra-files`） | 与 `version.txt` 同步 |
| `presets/*.yaml` | 不写 | 渲染时从 `version.txt` 注入 |

`npm test` 会校验前三者一致、且预设里没有 `version`。

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

## 渲染成 DSH 配置

不需要手写 `cordis.patch.yml`：

```bash
node scripts/render-presets.mjs --out cordis.patch.yml
```

脚本会为每个预设生成一条 `@deepseek-ai/dsh-agent-preset` 插入项，并把 `critic.enabled: true` 的预设渲染成两条：主预设 + `<id>-critic` 只读评审预设（`tool-fs` 关掉 write/edit，不挂 shell）。生成结果的结构由 `scripts/check-render.mjs` 校验。

### 技能挂载是自动的

DSH 的技能根是「一级目录 = 一个技能」，一条 `customSkillDirs` 会暴露该目录下全部技能。所以本仓库把技能放在 `skills/<group>/<name>/`，渲染器按预设的 `skills:` 反查每个技能属于哪个分组，只挂载这些分组：

```yaml
# presets/product-design.yaml 引用 product-design
customSkillDirs:
  - 'G:\dsh-kit\skills\product'
```

结果：选中 `product-design` 预设时，只看到 `product` 分组里的技能，不会看到 `design` / `frontend` / `backend` 的技能。

两条约束由 `check-render.mjs` 强制：

- 挂载了与预设无关的分组 → 报错；
- 引用的技能所在分组没挂载 → 报错。

手写时的等价形态如下，供对照：

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

- `customSkillDirs` 指向**分组目录**；渲染器已按 `skills:` 自动填写，一般不需要手写。
- `critic` 需要另建一个只读预设（`tool-fs` 关掉 write/edit），否则评审者会顺手改文件。
- `persona` 里的「不做什么」比「做什么」更重要，它决定角色边界。

## 校验

```bash
npm test
```

- `scripts/validate-skills.mjs`（零依赖）：技能两级布局、`id` 与文件名一致、`skills` 引用的技能存在、`deliverables` 非空、`persona` 非空、`version.txt` / manifest / `package.json` 三者版本一致、预设未自带 `version`、CHANGELOG 结构。
- `scripts/check-render.mjs`（需 js-yaml）：渲染结果是合法 YAML、每个预设都挂 `persona` / `skill-filesystem` / `tool-skill`、**技能隔离成立**、评审预设只读且无 shell、`critic` 引用的预设存在。

CI 用同一套脚本。
