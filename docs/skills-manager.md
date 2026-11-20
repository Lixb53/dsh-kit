# 外部技能安装与维护（skills-manager）

一个脚本按 `docs/skill-catalog.md` 的推荐清单安装外部技能，并支持增删改与版本维护。

## 真源与布局

| 项 | 位置 | 入库 | 说明 |
|---|---|---|---|
| 清单 | `skills-manifest.json` | 是 | 机器可读的「来源 + 版本 pin + 属于哪个预设」真源，来自 catalog |
| 下载物 | `.generated/external-skills/<包id>/` | 否 | `git fetch` 固定 ref 拉取，含 `.dsh-source.json`；**不挂载**，只当复制源 |
| 挂载点 | `.generated/preset-skills/<预设id>/<技能名>/SKILL.md` | 否 | `sync` 按预设平铺，`customSkillDirs` 指向这一层，实现角色隔离 |
| 挂载映射 | `external-skills.local.yaml` | 否 | `sync` 生成，`install:presets` 渲染时读取 |

两层分开是刻意的：下载物按「包」组织（一个包一份、保留上游目录结构），挂载点按「预设」组织（一个预设一个根、只放该角色该看的技能）。同事与技能都同名也不会打架，也不会再出现「下载物和挂载点挤在同一层、分不清谁被挂载」。

`kind: auto` 的包可自动安装；`kind: manual` 的（CLI / MCP / DSH 插件 / 许可未明）只给说明，按 catalog 手动处理。

## 命令

```bash
npm run skills -- list              # 列出清单 + 安装状态
npm run skills -- install           # 安装全部 auto 包（可带 id 只装指定包）
npm run skills -- install ui-design # 只装某个包（id 见 list）
npm run skills -- update            # 重装到清单 pin 的版本（覆盖）
npm run skills -- remove <id...>    # 删除已安装包
npm run skills -- status            # 查看挂载映射 + 每个预设挂到的技能
npm run skills -- sync              # 重建挂载点 .generated/preset-skills/ 并生成 external-skills.local.yaml
npm run skills -- doctor            # 自检：安装完整性 + 入口 SKILL.md + 挂载点与清单一致 + 声明漂移
```

底层用 `git fetch --depth 1 origin <ref>` 固定 tag 或 commit SHA，可复现；依赖用户已配置的 git 代理/凭据，Windows / macOS / Linux 通用。

## 首次使用

```bash
npm ci
npm run skills -- install    # 下载 auto 技能到 .generated/external-skills/
npm run skills -- sync       # 平铺到 .generated/preset-skills/<预设id>/ 并生成挂载映射
npm run install:presets      # 渲染并生成本机 bundle
# 把 .generated/dsh-role-presets/<预设id> 装进 DSH，开新会话验证
```

## 增删改与维护

- **增**：在 `skills-manifest.json` 加一条（先在 catalog 核实许可与 pin，并填 `presets`），`install <id>` → `sync` → `install:presets`。
- **改版本**：改清单里的 `ref`（保留 catalog 的 pin 约定：tag 优先，无 tag 用不可变 commit SHA），`update <id>` → `sync` → `install:presets`。
- **删**：`remove <id>` → `sync` → `install:presets`。`sync` 会整体重建挂载根，不会残留已删技能。
- **改归属**：只改清单的 `presets` 字段（同一个包可以挂给多个预设，会在各自挂载根下各复制一份），再 `sync`。`sync` 以 `presets/` 目录为预设清单真源，新增/改名预设后不需要改脚本。
- **只看状态**：`list` / `status` / `doctor`。

`sync` 的规则：

- 先算挂载计划再落盘：清单指向不存在的预设、入口缺 `SKILL.md`、同一预设下技能重名都会直接报错并中止（磁盘不动）。
- 计划通过后整体删除并重建 `.generated/preset-skills/`，只给有技能的预设写挂载根；没有外部技能的预设（如 backend-dev）不写空目录。
- 顺带清掉旧布局残留：`.generated/external-skills/` 下名字等于预设 id 且没有 `.dsh-source.json` 的目录会被删掉。
- 复制时跳过 `.git` 与 `.dsh-source.json`，挂载点里只有技能正文。

每次 `sync` 后都要重跑 `install:presets`，因为 bundle 里的 `customSkillDirs` 是渲染时写死的。

## 设计取舍

1. **不把外部包复制进 `skills/`**：保持 `skills/` 是唯一真源，外部包在仓库外、按 ref 拉取。
2. **下载物与挂载点分两层，挂载点按预设平铺**：一条 `customSkillDirs` 会整体暴露其下所有技能，所以给每个预设单独建根，只放该角色该看的技能，避免 Vue 规则进后端预设这类污染；下载物另存一层，便于按 ref 复现与清理。
3. **预设清单以 `presets/` 目录为真源**：脚本从 `presets/*.yaml` 读 id，不再硬编码预设名，新增/改名预设不会漏挂载或留残留。
4. **`manual` 包不假装能装**：spec-kit（CLI）、backendpro（白名单）、postgres-mcp（MCP）、dsh-notes-board（DSH 插件）、playwright-cli skills、frontend-design（许可未明）都只给说明，避免脚本"装了个空壳"。
5. **backend-dev 目前只有 manual 包**：所以渲染时对 backend-dev 的 `external_skills` 未挂载 warn 是预期行为，不是故障。

## 换机器

`.generated/` 与 `external-skills.local.yaml` 都不入库。新机器重做：

```bash
git clone <repo> && cd dsh-kit
npm ci
npm run skills -- install && npm run skills -- sync
npm run install:presets
# 安装 .generated/dsh-role-presets/<预设id> 到本机 DSH
```

manual 包按 catalog 各自在新机器重装/重配。
