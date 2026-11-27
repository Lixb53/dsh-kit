# 预设字段说明

`presets/<id>.yaml` 是声明式清单：描述「这个预设有什么职责、用哪些技能、能碰哪些工具、按什么标准评审、交付什么」。它是配置来源，不是可执行代码。

预设不限于「角色」：团队预设、评审器（critic）预设、单一工作流预设都可以用同一套字段描述；区别只在挂哪些技能、`tools` 与 `mcp` 的收紧程度。

**默认形态是薄预设**：预设本身不写行为文本（没有 `persona`），只声明「挂哪些技能、能碰哪些工具、按什么标准评审、交付什么」。角色的工作流与门禁写在技能里（`SKILL.md`），技能按需加载、不常驻上下文。`persona` 仍支持，但只用于确实需要常驻的边界声明，不是默认写法。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 必须与文件名一致，lowercase kebab-case |
| `name` | 是 | 展示名 |
| `description` | 建议 | 一行说明；渲染成 DSH 预设的 `description`，缺省时从 `persona` 截取 |
| `persona` | 否 | 常驻角色人格与边界。**薄预设不写**：行为交给技能；写了就渲染成 persona 插件的 `prefix` |
| `skills` | 是 | 引用本仓库 `skills/<group>/<name>/` 下的技能名，不得内联正文；同时决定挂载哪些分组 |
| `external_skills` | 否 | 需要额外安装的外部技能包（见 `docs/skill-catalog.md`） |
| `tools` | 否 | 工具白名单：`fs` / `pwsh` / `web` / `jobs` / `todo` / `present` / `askUser` / `codegraph` |
| `mcp` | 否 | 预留字段：渲染器当前**不输出**预设级 MCP；需要 MCP 请在 profile 层配置，不要指望它随预设挂载 |
| `critic` | 否 | 只读评审子代理：`enabled`、`mode: read-only`。评审标准由 critic 预设挂载的技能提供，预设里不再内联 rubric |
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

## 最小示例（薄预设）

```yaml
id: my-role
name: 我的角色
description: 一句话说明这个角色何时被选中
skills:
  - my-skill
tools:
  - fs
deliverables:
  - out/<feature>/
```

角色「怎么做」写在 `skills/<group>/my-skill/SKILL.md`，预设只引用名字。

## 渲染成 DSH 配置

不需要手写 `cordis.patch.yml`：

```bash
npm run install:presets   # 推荐：生成可迁移、可卸载的本地 bundle
# 或仅渲染 patch 调试：
node scripts/render-presets.mjs --out cordis.patch.yml
```

`install:presets` 会在本机**为每个预设生成一个独立 bundle**：`.generated/dsh-role-presets/<预设id>/`（`@local/dsh-preset-<预设id>`，含 `package.json` + `cordis.patch.yml`），用 `plugin_manager install_bundle` 安装单个目录即可，安装/卸载/升级互不影响；`--combined` 退回四合一单包（`@local/dsh-role-presets`）。脚本为每个预设生成一条 `@deepseek-ai/dsh-agent-preset` 插入项，并把 `critic.enabled: true` 的预设渲染成两条：主预设 + `<id>-critic` 只读评审预设（`tool-fs` 关掉 write/edit，不挂 shell）——critic 与它的主预设在同一个 bundle 里，因为 `agentPreset` 引用不能跨 bundle。生成结果的结构由 `scripts/check-render.mjs` 校验。

渲染器也可作为模块导入（`renderPresets()` / `REPO_ROOT`），这样校验与安装脚本无需子进程，规避某些沙箱下的 `spawn EPERM`。

### 技能挂载是自动的

DSH 的技能根是「一级目录 = 一个技能」，一条 `customSkillDirs` 会暴露该目录下全部技能。所以本仓库把技能放在 `skills/<group>/<name>/`，渲染器按预设的 `skills:` 反查每个技能属于哪个分组，只挂载这些分组：

```yaml
# presets/product-design.yaml 引用 product-design
customSkillDirs:
  - '<本机仓库根>/skills/product'
```

`<本机仓库根>` 由 `render-presets.mjs` 在**目标机器**运行时推导（默认从脚本位置计算，与 cwd / 操作系统无关），不入库、不写死盘符。结果：选中 `product-design` 预设时，只看到 `product` 分组里的技能，不会看到 `design` / `frontend` / `backend` 的技能。

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
          # 薄预设没有这一段；只有写了 persona 才渲染 persona 插件
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: |
                （可选：把 persona 贴到这里）
          - id: skill-filesystem
            name: '@deepseek-ai/dsh-skill-filesystem'
            config:
              includeDefaultRoots: false
              customSkillDirs:
                - '<本机仓库根>/skills'
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
- 不要在仓库里提交绝对路径：生成物（`.generated/`、`cordis.patch.yml`）和外部技能本机映射（`external-skills.local.yaml`）都已 gitignore，换机器时重新生成/配置。
- `critic` 需要另建一个只读预设（`tool-fs` 关掉 write/edit），否则评审者会顺手改文件；该评审预设同样是薄预设，评审标准来自它挂载的技能。
- 薄预设的「不做什么」写在技能里比写在 persona 里更可靠：技能只在需要时加载，不会每轮都占用上下文。

## 校验

```bash
npm test
```

- `scripts/validate-skills.mjs`（零依赖）：技能两级布局、`id` 与文件名一致、`skills` 引用的技能存在、`deliverables` 非空、`version.txt` / manifest / `package.json` 三者版本一致、预设未自带 `version`、CHANGELOG 结构。`persona` 可选，不检查其是否存在。
- `scripts/check-render.mjs`（需 js-yaml）：渲染结果是合法 YAML、每个预设都挂 `skill-filesystem` / `tool-skill`（`persona` 可选，存在时 `prefix` 不得为空）、**技能隔离成立**、评审预设只读且无 shell、`critic` 引用的预设存在。
- `scripts/check-plugin-config.mjs`（需 js-yaml + 本机 DSH）：用**本机正在运行的 DSH 安装**里每个插件真实的 `Config` schema，逐行校验渲染出的 `config`。`tools: codegraph` 渲染出的 `dsh-plugin-codegraph-tool` 由 profile 安装的 codegraph bundle 提供，不在 DSH 安装目录内，因此该脚本还会从 `$DSH_PROFILE_DIR` 解析包并支持 ESM 插件。

### 为什么需要 check-plugin-config

`@deepseek-ai/dsh-agent-preset` 只负责注册声明，真正挂载子插件树由 registry 的 `mountPreset()` 完成。**任何一行插件激活失败（包括 schema 校验失败）都会让整棵预设挂载被拒绝**，registry 把该预设标记为 `broken`；而 Web 端新任务选择器只渲染 `broken === undefined` 的预设，于是失败表现为「bundle 装好了、也启用了，但选择器里看不到」，没有任何可见报错（设置页的 Agent 预设分区仍会显示带「加载失败」的卡片）。

最常见的触发方式是**上游把某个配置字段改成 `.required()` 且不给默认值**：我们渲染时只写了 `name`，本机一升级 DSH 就静默失效。`check-render.mjs` 只看我们自己的渲染结构，看不到上游 schema，所以需要这个脚本补位。

已发生的实例：`dsh-tool-todo` 的 `allowParallelInProgress`、`dsh-tool-fs-search` 的 `sampleOverCapGlobResults`。

### 运行方式

```bash
# 普通 node：能从安装目录读到包时校验，读不到则跳过并返回 0
node scripts/check-plugin-config.mjs

# Desktop（安装在 app.asar 内）：必须用运行中的 Electron 以 node 模式执行
$env:ELECTRON_RUN_AS_NODE = '1'
& "$env:DSH_NODE_EXECUTABLE" scripts/check-plugin-config.mjs
```

- 安装目录取 `$DSH_INSTALL_DIR`，或用 `--dsh-install <dir>` 指定。
- 预设里引用的 profile 插件（如 `dsh-plugin-codegraph-tool`）从 `$DSH_PROFILE_DIR` 的 `package.json` 解析；ESM-only 包回退到动态 `import()` 读取 `Config`。这类插件的 peer 依赖（`@deepseek-ai/dsh-tools` 等）只在 DSH 安装目录内，从 profile 视点无法加载时会**跳过并标注**，不算失败。profile 未安装对应 bundle 时，预设挂载会因模块缺失而失败。
- **拿不到安装目录（例如 CI 的 ubuntu runner）时跳过并返回 0**，不会卡住 `npm test`；跳过原因会打印出来。
- `npm run install:presets` 在 `$DSH_INSTALL_DIR` 存在时会自动串联这一步，校验不通过就中止安装——趁早失败，而不是等到 GUI 里发现预设消失。

CI 用同一套脚本。
