# 四角色预设使用指南（逐步操作）

> 适用版本：仓库 `main` 最新（本文按 commit `8b63960` 更新）。
> 目标：在任意机器（Windows / macOS / Linux）上，把四个角色预设及其外部技能装进 DSH 并日常使用。
> 核心原则：**仓库里不放机器专属路径**。所有绝对路径都在目标机器上运行时生成，生成物不入库。

---

## 0. 先分清四层东西（避免概念混乱）

| 层 | 位置 | 是否入库 | 作用 |
|---|---|---|---|
| ① 声明源 | `presets/*.yaml`、`skills/`、`skills-manifest.json` | 是 | 你维护的真相源：角色提示词、引用的内部技能、外部技能清单与 pin |
| ② 外部技能 | 下载物 `.generated/external-skills/<包id>/` + 挂载点 `.generated/preset-skills/<预设id>/` | 否（gitignore） | 包按 pin 下载到前者（不挂载）；后者每个预设一个目录，只放该预设可见的技能，bundle 指向它 |
| ③ 本机 bundle | `.generated/dsh-role-presets/<预设id>/`（每个 `package.json` + `cordis.patch.yml`） | 否（gitignore） | 由 ① + ② 在本机渲染出的 DSH bundle，**一个预设一个包**，可单独安装/卸载；路径按本机推导 |
| ④ 已安装插件 | DSH profile（本机如 `G:\dsh-env\home\profiles\desktop`） | 否 | ③ 装进 DSH 后生效，GUI 里可选预设 |

日常流程：改① → 装/更新② → 渲染③ → 装进④ → 新会话选预设。换机器只重做②③④。

四个预设：`product-design`（产品）→ `ui-design`（UI）→ `frontend-dev` / `backend-dev`（前后端）。每个还自动生成一个同名 `-critic` 只读评审预设，不用手动选。

---

## 1. 首次安装（当前 Windows 机器）

### 步骤 1.1 — 确认前置条件

在 PowerShell 里逐条执行，确认有输出：

```powershell
node --version     # 需要 v18+，实测 v22 可用
npm --version
git --version
```

确认 DSH 正在运行：浏览器打开 `http://127.0.0.1:60400`，能看到会话界面。

确认仓库已是最新：

```powershell
cd G:\dsh-kit
git pull
git log --oneline -1     # 应是 8b63960 或更新
```

> 外部技能用 `git fetch` 下载，依赖你已配置的 git 代理/凭据。本机 `~/.gitconfig` 里 github.com 走 `127.0.0.1:7897`，脚本会自动沿用，无需额外设置。

### 步骤 1.2 — 安装依赖

```powershell
cd G:\dsh-kit
npm ci
```

成功标志：末尾无 `error`，出现 `added N packages`。若 `npm ci` 报 lock 文件不一致，改用 `npm install`（仅此情况）。

### 步骤 1.3 — 一键安装外部技能（推荐）

外部技能是各角色的"知识包"。脚本按 [skills-manifest.json](skills-manifest.json) 的版本 pin 自动下载，并按预设隔离（下载物与挂载点分两层，见下表）：

```powershell
cd G:\dsh-kit
npm run skills -- install     # 下载 8 个可自动安装的包 → .generated/external-skills/<包id>/
npm run skills -- doctor      # 自检安装完整性 + 挂载点是否与清单一致
npm run skills -- sync        # 平铺到 .generated/preset-skills/<预设id>/，并生成 external-skills.local.yaml
```

成功后 `external-skills.local.yaml` 应包含 product-design / ui-design / frontend-dev 三个挂载根，每个指向自己的 `.generated\preset-skills\<预设id>`（backend-dev 的三个包都是手动类，故无映射属正常）。查看内容：`npm run skills -- status`。

| 目录 | 内容 | 是否挂载 |
|---|---|---|
| `.generated/external-skills/<包id>/` | 按 pin 下载的原始包，含 `.dsh-source.json` | 否（只作为复制源） |
| `.generated/preset-skills/<预设id>/<技能名>/SKILL.md` | 该预设可见的技能 | 是（`customSkillDirs` 指向这一层） |

一个预设一个挂载根，**不要**把同一个目录配给多个预设：一条 `customSkillDirs` 会整体暴露目录下的所有技能，共用就会互相污染。

脚本会自动装这些（实测已全部验证）：

| 预设 | 技能 |
|---|---|
| product-design | one-line-prototype、deliver-prd、deliver-user-stories、deliver-acceptance-criteria、deliver-edge-cases、develop-adr、utility-mermaid-diagrams |
| ui-design | ui-ux-pro-max、design-system、design-tokens、design-component、design-qa、gate、critique、apply-aesthetic、a11y-core、accessibility-lead、contrast-master |
| frontend-dev | vercel-react-best-practices、composition-patterns、web-design-guidelines、code-review-skill、core-web-vitals、performance、web-quality-audit |

少数 `manual` 包（spec-kit CLI、backendpro、postgres-mcp、dsh-notes-board、playwright-cli skills、frontend-design）脚本不会装，按 [docs/skill-catalog.md](skill-catalog.md) 手动处理。详见 [docs/skills-manager.md](skills-manager.md)。

<details>
<summary>备用：手动配置外部技能（不用脚本时）</summary>

若不想用脚本，可复制模板手工填写：

```powershell
copy external-skills.local.example.yaml external-skills.local.yaml
```

编辑文件，把每个预设指向一个"只含该角色技能"的目录（DSH 只认目录下含 `SKILL.md` 的直接子目录，深层需平铺）。注意：一条目录会被整体暴露给该预设，四个预设都指同一个目录会失去隔离。此文件已被 gitignore。

</details>

### 步骤 1.4 — 生成本机 bundle

```powershell
cd G:\dsh-kit
npm run install:presets
```

成功标志：

```
✓ bundle 已生成：G:\dsh-kit\.generated\dsh-role-presets
    backend-dev          G:\dsh-kit\.generated\dsh-role-presets\backend-dev
    frontend-dev         G:\dsh-kit\.generated\dsh-role-presets\frontend-dev
    product-design       G:\dsh-kit\.generated\dsh-role-presets\product-design
    ui-design            G:\dsh-kit\.generated\dsh-role-presets\ui-design
```

核对生成物：

```powershell
Get-ChildItem G:\dsh-kit\.generated\dsh-role-presets
# 应有四个预设目录，每个目录里有 cordis.patch.yml 和 package.json
```

验证挂载正确（可选）：

```powershell
Select-String -Path G:\dsh-kit\.generated\dsh-role-presets\product-design\cordis.patch.yml -Pattern 'customSkillDirs' -Context 0,2
```

期望每个预设的 bundle 只挂自己的 `skills\<分组>` +（外部技能）`.generated\preset-skills\<预设id>`——都是运行时推导的路径，不是写死的常量；预设之间不共用挂载目录，bundle 也互相独立。

### 步骤 1.5 — 把 bundle 装进 DSH

**一个预设一个 bundle，想装哪个角色就装哪个目录**（四个都要就装四个）。两种方式任选其一：

**方式 A：让我来装（推荐）**
对我说：「把 G:\dsh-kit\.generated\dsh-role-presets\product-design 安装为 DSH bundle」（或列出多个目录）。我调用 `plugin_manager install_bundle` 完成并回报结果。

**方式 B：GUI 手动装**
打开 `http://127.0.0.1:60400` → 设置/插件管理（Plugins）→ 添加插件（Add plugin）→ 选本地目录 → 选中某个预设目录（如 `...\dsh-role-presets\product-design`）→ 确认。

成功判断：插件列表出现 `@local/dsh-preset-<预设id>`（如 `@local/dsh-preset-product-design`）且状态 enabled。只装了部分预设时，列表里就只有那几个——这正是独立安装的用途。若带错误诊断，把诊断文本发我。

### 步骤 1.6 — 验证生效

1. **必须开一个新会话**。已有会话沿用旧插件组合，看不到新预设。
2. 预设选择器里应出现四个新选项：产品设计 / UI 设计 / 前端开发 / 后端开发。旧的 `产品/UI 设计` 仍在列表里——别选混。
3. 选一个发条简单任务（如"帮我写一个登录页的需求澄清"），看回复是否符合角色风格（声明 S/M/L 分级、有门禁结论）。

---

## 2. 日常使用

### 2.1 选哪个预设

| 你现在的任务 | 选 |
|---|---|
| 需求还模糊、要 PRD / 流程图 / 原型 / 规则标注 | `product-design` |
| 需求清楚了、要视觉方向 / 令牌 / 组件 / 可运行原型 | `ui-design` |
| 有设计稿、要落成前端代码 / 性能 / E2E | `frontend-dev` |
| 要架构决策 / ADR / 数据模型 / API 契约 / 容量 | `backend-dev` |

跨角色交接物写在各预设的 `handoff` 字段里（`docs/presets.md` 有说明）。

### 2.2 门禁怎么工作（重要）

- **C0 确定性门禁：每次必跑。** 产品角色的 R 编号四处可追溯、UI 的 lint + 结构断言双 0、前端的类型检查/构建/测试、后端的引用可 grep 与数据库只读——不会跳过。
- **C1 独立评审：默认关闭。** 只有三种情况拉起一次只读 critic（恰好一轮，返工不复审）：
  1. 你明确说「评审一下 / 复查 / 独立看看」；
  2. 含不可逆/高代价决策（L 级 PRD 定稿、架构变更、ADR 定稿、生产库变更前）；
  3. C0 全过但主代理对某主观维度没把握，声明理由后申请。

未触发时交付里会有「未经独立评审（按需 critic 未触发）」——正常，不是漏了。

### 2.3 让 critic 跑起来

在任务里加一句即可：

```
按 product-design 预设做这个需求，完成后评审一下。
```

critic 只读你的产物和锁定契约，输出 Keep / Fix(P0/P1) / Quick wins / 需实测 / 门禁结论。主代理按问题清单自查 + 重跑 C0，不自动开第二轮；你要求才开。

---

## 3. 维护：改预设 / 改技能 / 改外部技能

### 3.1 改预设或仓库内技能

每次改 `presets/*.yaml` 或 `skills/` 下内容：

```powershell
cd G:\dsh-kit
npm test                      # 必须 0 错误
npm run install:presets       # 重新生成本机 bundle
```

然后**重装/更新对应预设的 bundle**（改了哪个预设就重装哪个目录；方式 A 让我装，或 GUI 里更新），最后开**新会话**验证。已有会话不会吃到新定义（DSH 设计如此）。

> 改预设**结构**（新增字段/改渲染语义）须同步 `scripts/render-presets.mjs` 与 `docs/presets.md`。

### 3.2 增删改外部技能

改 `skills-manifest.json`，然后按类型操作：

```powershell
# 增：加条目（先在 catalog 核实许可与 pin）后
npm run skills -- install <新id>
npm run skills -- sync

# 改版本：改 ref 后
npm run skills -- update <id>
npm run skills -- sync

# 删：
npm run skills -- remove <id>
npm run skills -- sync

# 最后都要重渲染 bundle
npm run install:presets
```

`sync` 会先清空各预设挂载根，删除后不会残留。每次 `sync` 后必须重跑 `install:presets`（bundle 里的 `customSkillDirs` 是渲染时写进去的）。详见 [docs/skills-manager.md](skills-manager.md)。

---

## 4. 换机器 / 换 macOS

仓库不含绝对路径，新机器重做"下载 + 渲染 + 安装"：

```bash
git clone <仓库地址> dsh-kit
cd dsh-kit
npm ci
npm run skills -- install && npm run skills -- sync   # 外部技能按新机器重新拉取
npm run install:presets
# 把新打印的 .generated/dsh-role-presets/<预设id> 装进本机 DSH
```

manual 包（CLI/MCP/插件）按 catalog 在新机器各自重装。开新会话验证四个预设出现。

旧机器的 bundle 留着无妨（指向旧路径，已不用）。

---

## 5. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 选不到新预设 | 开的是旧会话 | 开一个**全新会话**再选 |
| 渲染报 `external_skills 未配置` | 没跑 `skills -- install/sync` | 属预期 warn，不配也能用；要配见 1.3 |
| `skills -- install` 下载失败 | git 代理/凭据问题 | 确认 `git ls-remote https://github.com/...` 能通；脚本沿用你的 gitconfig |
| `skills -- doctor` 报未安装/版本不符 | 没装或清单 ref 变了 | `npm run skills -- install` 或 `update` |
| 外部技能没生效 | 没 `sync` 或没重渲染 bundle | `skills -- sync` → `install:presets` → 重装 bundle |
| `.generated/external-skills/` 下出现与预设同名的目录 | 旧版把挂载点放在下载物同一层 | 跑一次 `skills -- sync`：自动清理旧布局残留，挂载点改在 `.generated/preset-skills/<预设id>/` |
| `npm test` 报 `spawnSync ... EPERM` | 旧版 check-render 用子进程；当前已直接调用 | 确认已 pull 到 `400629c` 之后 |
| git 提交报 `.git/index.lock: Permission denied` | Windows 文件权限 | 本机已为当前用户补 `.git` 完整控制权限；恢复脚本在 `G:\dsh-work\acl-recovery\acl-backup-b5372d9587fe4a909455246a1032dd91.json.ps1`（不建议恢复，否则 git 又写不进） |
| 技能找不到（warn 技能未挂载） | 移动/重命名了仓库目录 | 在新位置重跑 `install:presets`，再重装 bundle |

---

## 6. 命令速查

```powershell
# 首次 / 换机器
npm ci
npm run skills -- install && npm run skills -- sync
npm run install:presets
# → 安装 .generated/dsh-role-presets/<需要的预设id> 到 DSH，开新会话

# 外部技能维护
npm run skills -- list / status / doctor
npm run skills -- install [id] / update [id] / remove <id> / sync

# 改了预设/技能后
npm test
npm run install:presets
# → 重装 bundle，开新会话

# 调试渲染
node scripts/render-presets.mjs --out cordis.patch.yml
node scripts/render-presets.mjs --only product-design,ui-design
node scripts/render-presets.mjs --no-critic
```

---

## 7. 相关文件索引

| 文件 | 内容 |
|---|---|
| `README.md` | 仓库总览、快速开始、版本与发版 |
| `docs/presets.md` | 预设字段说明、渲染与技能挂载 |
| `docs/skills-manager.md` | 外部技能安装与维护（增删改/版本/隔离） |
| `docs/skill-catalog.md` | 外部技能来源、版本 pin、许可 |
| `docs/external-skills.md` | 外部技能"清单与安装分离"方案原理 |
| `skills-manifest.json` | 外部技能机器可读清单（脚本真源） |
| `AGENTS.md` | AI 在本仓库工作的硬约束 |
| `presets/*.yaml` | 四个角色预设声明（你主要改这里） |
| `scripts/skills-manager.mjs` | 外部技能安装/维护脚本 |
| `scripts/install-presets.mjs` | 生成本机 bundle |
| `scripts/render-presets.mjs` | 渲染器（可导入 `renderPresets()`） |
| `external-skills.local.example.yaml` | 手动挂载映射模板（脚本用户无需关注） |
