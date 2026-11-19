# 外部技能安装与维护（skills-manager）

一个脚本按 `docs/skill-catalog.md` 的推荐清单安装外部技能，并支持增删改与版本维护。

## 真源与布局

| 项 | 位置 | 入库 | 说明 |
|---|---|---|---|
| 清单 | `skills-manifest.json` | 是 | 机器可读的「来源 + 版本 pin + 属于哪个预设」真源，来自 catalog |
| 下载物 | `.generated/external-skills/<包id>/` | 否 | `git fetch` 固定 ref 拉取，只保留 `entries` 声明的技能子树 |
| 挂载布局 | `.generated/external-skills/<预设>/<技能名>/` | 否 | `sync` 按预设平铺，实现角色隔离 |
| 挂载映射 | `external-skills.local.yaml` | 否 | `sync` 生成，`install:presets` 渲染时读取 |

`kind: auto` 的包可自动安装；`kind: manual` 的（CLI / MCP / DSH 插件 / 许可未明）只给说明，按 catalog 手动处理。

## 命令

```bash
npm run skills -- list              # 列出清单 + 安装状态
npm run skills -- install           # 安装全部 auto 包（可带 id 只装指定包）
npm run skills -- install ui-design # 只装某个包（id 见 list）
npm run skills -- update            # 重装到清单 pin 的版本（覆盖）
npm run skills -- remove <id...>    # 删除已安装包
npm run skills -- status            # 查看当前挂载映射
npm run skills -- sync              # 重建 external-skills.local.yaml
npm run skills -- doctor            # 自检：安装完整性 + SKILL.md 落点
```

底层用 `git fetch --depth 1 origin <ref>` 固定 tag 或 commit SHA，可复现；依赖用户已配置的 git 代理/凭据，Windows / macOS / Linux 通用。

## 首次使用

```bash
npm ci
npm run skills -- install    # 下载 auto 技能
npm run skills -- sync       # 生成按角色隔离的挂载映射
npm run install:presets      # 渲染并生成本机 bundle
# 把 .generated/dsh-role-presets 装进 DSH，开新会话验证
```

## 增删改与维护

- **增**：在 `skills-manifest.json` 加一条（先在 catalog 核实许可与 pin），`install <id>` → `sync` → `install:presets`。
- **改版本**：改清单里的 `ref`（保留 catalog 的 pin 约定：tag 优先，无 tag 用不可变 SHA），`update <id>` → `sync` → `install:presets`。
- **删**：`remove <id>` → `sync` → `install:presets`。`sync` 会先清空各预设挂载根，不会残留已删技能。
- **只看状态**：`list` / `status` / `doctor`。

每次 `sync` 后都要重跑 `install:presets`，因为 bundle 里的 `customSkillDirs` 是渲染时写死的。

## 设计取舍

1. **不把外部包复制进 `skills/`**：保持 `skills/` 是唯一真源，外部包在仓库外、按 ref 拉取。
2. **按预设平铺而非共享根**：一条 `customSkillDirs` 会整体暴露其下所有技能，所以给每个预设单独建根，只放该角色该看的技能，避免 Vue 规则进后端预设这类污染。
3. **`manual` 包不假装能装**：spec-kit（CLI）、backendpro（白名单）、postgres-mcp（MCP）、dsh-notes-board（DSH 插件）、playwright-cli skills、frontend-design（许可未明）都只给说明，避免脚本"装了个空壳"。
4. **backend-dev 目前只有 manual 包**：所以渲染时对 backend-dev 的 `external_skills` 未挂载 warn 是预期行为，不是故障。

## 换机器

`.generated/` 与 `external-skills.local.yaml` 都不入库。新机器重做：

```bash
git clone <repo> && cd dsh-kit
npm ci
npm run skills -- install && npm run skills -- sync
npm run install:presets
# 安装 .generated/dsh-role-presets 到本机 DSH
```

manual 包按 catalog 各自在新机器重装/重配。
