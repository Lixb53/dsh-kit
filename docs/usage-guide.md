# 四角色预设使用指南（逐步操作）

> 适用版本：仓库 `main`，commit `400629c` 起。
> 目标：在任意机器（Windows / macOS / Linux）上，把本仓库的四个角色预设装进 DSH 并日常使用。
> 核心原则：**仓库里不放机器专属路径**。所有绝对路径都在目标机器上运行时生成，生成物不入库。

---

## 0. 先分清三层东西（避免概念混乱）

| 层 | 位置 | 是否入库 | 作用 |
|---|---|---|---|
| ① 声明源 | `G:\dsh-kit\presets\*.yaml`、`skills/` | 是 | 你维护的真相源：角色提示词、引用哪些技能、门禁 |
| ② 生成物 | `G:\dsh-kit\.generated\dsh-role-presets\`（`package.json` + `cordis.patch.yml`） | 否（已 gitignore） | 在本机由 ① 渲染出来的 DSH bundle，路径按本机推导 |
| ③ 已安装插件 | DSH profile（本机 `G:\dsh-env\home\profiles\desktop`） | 否 | ② 被安装进 DSH 后生效，GUI 里能看到预设 |

日常流程：改① → 跑命令生成② → 把②装进③ → 新会话选预设。换机器只重做②和③。

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
git log --oneline -1     # 应显示 400629c 或更新
```

### 步骤 1.2 — 安装依赖

```powershell
cd G:\dsh-kit
npm ci
```

- 成功标志：末尾无 `error`，出现 `added N packages`。
- 若 `npm ci` 报 lock 文件不一致，改用 `npm install`（仅此情况）。

### 步骤 1.3 —（可选但推荐）配置外部技能

外部技能是各角色的「知识包」，不配也能用，但会打折。catalog 在 `docs/skill-catalog.md`。

你本机已经装了一批技能，目录是：

```
C:\Users\51967\Documents\dsh-presets\product-ui-design-v1\skills
```

里面有 `ui-ux-pro-max`、`vercel-react-best-practices`、`web-design-guidelines`、`composition-patterns`、`webapp-testing`、`design-critique` 等 21 个。

**复制模板并填写：**

```powershell
cd G:\dsh-kit
copy external-skills.local.example.yaml external-skills.local.yaml
```

用编辑器打开 `external-skills.local.yaml`，改成下面这样（按你本机实际路径）：

```yaml
ui-design:
  - 'C:\Users\51967\Documents\dsh-presets\product-ui-design-v1\skills'
product-design:
  - 'C:\Users\51967\Documents\dsh-presets\product-ui-design-v1\skills'
frontend-dev:
  - 'C:\Users\51967\Documents\dsh-presets\product-ui-design-v1\skills'
backend-dev:
  - 'C:\Users\51967\Documents\dsh-presets\product-ui-design-v1\skills'
```

⚠️ **隔离代价**：一条目录会被整体暴露给该预设。上面这样四个预设都会看到全部 21 个技能，失去按角色隔离的效果。若要保持隔离，为不同预设准备不同安装根（每个根只放该角色该看的技能），分别填这里。可以只给一两个预设配置，其余留空。

确认文件确实生效：下一步渲染时，`warn ... external_skills ... 未配置` 的提示里，配置了预设的那几条会消失。

> 这个文件已被 gitignore，永远不会提交。换机器时每台机器各配一份。

### 步骤 1.4 — 生成本机 bundle

```powershell
cd G:\dsh-kit
npm run install:presets
```

成功标志（末尾三行）：

```
✓ bundle 已生成：G:\dsh-kit\.generated\dsh-role-presets
  下一步：用 plugin_manager install_bundle 安装该目录，或在 GUI 插件管理里安装。
  换机器 / 换 OS：重新 clone 仓库 → npm ci → node scripts/install-presets.mjs → 重新安装此目录。
```

核对生成物：

```powershell
Get-ChildItem G:\dsh-kit\.generated\dsh-role-presets
# 应有 cordis.patch.yml 和 package.json
```

验证路径是按本机推导的、没有写死（可选）：

```powershell
Select-String -Path G:\dsh-kit\.generated\dsh-role-presets\cordis.patch.yml -Pattern 'customSkillDirs' -Context 0,1 | Select-Object -First 8
```

期望看到 `'G:\dsh-kit\skills\product'` 等——这是**运行时从仓库位置推导出来的**，不是常量。

### 步骤 1.5 — 把 bundle 装进 DSH

两种方式任选其一：

**方式 A：让我来装（推荐，最省事）**
直接对我说：「把 G:\dsh-kit\.generated\dsh-role-presets 安装为 DSH bundle」。我会调用 `plugin_manager install_bundle` 完成，并回报安装结果。

**方式 B：你在 GUI 里装**
打开 `http://127.0.0.1:60400` → 设置/插件管理（Plugins）→ 添加插件（Add plugin）→ 选择本地目录 → 选中 `G:\dsh-kit\.generated\dsh-role-presets` → 确认。

安装成功的判断依据：插件列表里出现 `@local/dsh-role-presets`，且状态为 enabled。如果条目存在但带错误诊断，说明 bundle 有问题，把诊断文本发我。

### 步骤 1.6 — 验证生效

1. **必须开一个新会话**。已有会话会沿用旧的插件组合，看不到新预设。
2. 在新建会话的预设选择器（Agent Preset / 智能体预设）里，应能看到四个新选项：
   - 产品设计（`product-design`）
   - UI 设计（`ui-design`）
   - 前端开发（`frontend-dev`）
   - 后端开发（`backend-dev`）
   - 旧的 `产品/UI 设计`（`product-ui-design`）仍在列表里——别选混。
3. 随便选一个，发一条简单任务（如「帮我写一个登录页的需求澄清」），看回复是否符合该角色风格（会声明 S/M/L 分级、有门禁结论）。

---

## 1b.（推荐）用脚本一键安装外部技能

外部技能（各角色的知识包）可以不用手动配，交给脚本：

```powershell
cd G:\dsh-kit
npm run skills -- install     # 按 skills-manifest.json 的 pin 下载全部可自动安装的包
npm run skills -- sync        # 生成按角色隔离的挂载映射 external-skills.local.yaml
npm run install:presets       # 重新渲染 bundle（会带上外部技能）
```

维护命令：`npm run skills -- list`（看清单与状态）、`update`（重装到 pin 版本）、`remove <id>`（删除）、`status`、`doctor`（自检）。增删改只需改 `skills-manifest.json` 再 `install/update` + `sync` + `install:presets`。完整说明见 [`docs/skills-manager.md`](skills-manager.md)。

> 脚本生成的 `external-skills.local.yaml` 会覆盖第 1.3 步的手工配置——两者二选一，推荐用脚本。少数 `manual` 包（spec-kit / backendpro / postgres-mcp 等 CLI/MCP/插件）仍需按 catalog 手动安装。

## 2. 日常使用

### 2.1 选哪个预设

按交付链从上到下用：

| 你现在的任务 | 选 |
|---|---|
| 需求还模糊、要 PRD / 流程图 / 原型 / 规则标注 | `product-design` |
| 需求清楚了、要视觉方向 / 令牌 / 组件 / 可运行原型 | `ui-design` |
| 有设计稿、要落成前端代码 / 性能 / E2E | `frontend-dev` |
| 要架构决策 / ADR / 数据模型 / API 契约 / 容量 | `backend-dev` |

跨角色交接物写在各预设的 `handoff` 字段里（`docs/presets.md` 有说明）。

### 2.2 门禁怎么工作（重要）

每个预设都内置两层门禁，写入了 persona：

- **C0 确定性门禁：每次必跑。** 例如产品角色的 R 编号四处可追溯、UI 的 lint + 结构断言双 0、前端的类型检查/构建/测试、后端的引用可 grep 与数据库只读。这一步不会跳过。
- **C1 独立评审：默认关闭。** 只有以下三种情况才拉起一次只读 critic（恰好一轮，返工不复审）：
  1. 你明确说「评审一下 / 复查 / 独立看看」；
  2. 任务含不可逆或高代价决策（如 L 级 PRD 定稿、架构变更、ADR 定稿、生产库变更前）；
  3. C0 全过但主代理对某个主观维度没把握，主动声明理由后申请。

未触发时，交付里会有一行「未经独立评审（按需 critic 未触发）」——看到这行是正常的，不是漏了。

### 2.3 怎么让 critic 跑起来

直接在任务里加一句即可，例如：

```
按 product-design 预设做这个需求，完成后评审一下。
```

触发后 critic 只读你的产物和锁定契约，输出 Keep / Fix(P0/P1) / Quick wins / 需实测 / 门禁结论。主代理按问题清单自查 + 重跑 C0，不再自动开第二轮；你要求才会开第二轮对账。

---

## 3. 改了预设/技能之后

每次改 `presets/*.yaml` 或 `skills/` 下的内容：

```powershell
cd G:\dsh-kit
npm test                      # 必须 0 错误：validate + check-render
npm run install:presets       # 重新生成本机 bundle
```

然后**重新安装/更新** bundle：

- 方式 A：对我说「重新安装 G:\dsh-kit\.generated\dsh-role-presets」；
- 方式 B：GUI 插件管理里对该 bundle 执行更新/重装。

最后开**新会话**验证。已有会话不会吃到新定义（这是 DSH 的设计：Agent 保持启动时的插件组合）。

> 如果改了预设的**结构**（新增字段或改渲染语义），按 AGENTS.md 要求同步 `scripts/render-presets.mjs` 与 `docs/presets.md`。

---

## 4. 换机器 / 换 macOS

仓库本身不含绝对路径，所以迁移只需在新机器上重做「生成 + 安装」。

### 步骤 4.1 — 新机器准备

```bash
git clone <你的仓库地址> dsh-kit
cd dsh-kit
npm ci
```

macOS / Linux 用 bash 执行上面命令；路径分隔符由脚本自动处理。

### 步骤 4.2 —（可选）重配外部技能

`external-skills.local.yaml` 不入库，不会随 clone 过来。在新机器上重新复制模板并填**新机器**的路径：

```bash
cp external-skills.local.example.yaml external-skills.local.yaml
# 编辑文件，填入新机器上外部技能的实际安装目录
```

### 步骤 4.3 — 生成并安装

```bash
npm run install:presets
```

脚本会打印新机器上的 bundle 目录（例如 `/Users/you/dsh-kit/.generated/dsh-role-presets`）。把这个目录装进新机器的 DSH（GUI 添加插件，或让我调用 `plugin_manager install_bundle`）。

### 步骤 4.4 — 验证

开新会话 → 预设选择器里出现四个角色 → 跑一个简单任务确认风格。

旧机器上的 bundle 留着无妨；它指向旧路径，但你已经不用那台机器了。

---

## 5. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 选不到新预设 | 开的是旧会话 | 开一个**全新会话**再选 |
| 渲染时报 `external_skills 未配置` | 没建 `external-skills.local.yaml` | 属预期 warn，不配也能用；要配见 1.3 |
| `npm test` 报 `spawnSync ... EPERM` | 旧版本 check-render 用子进程；当前版本已改为直接调用 | 确认已 `git pull` 到 `400629c` 之后；仍出现则把完整报错发我 |
| git 提交报 `.git/index.lock: Permission denied` | Windows 文件权限 | 曾在本机修过：为当前用户补了 `.git` 完整控制权限；恢复脚本在 `G:\dsh-work\acl-recovery\acl-backup-b5372d9587fe4a909455246a1032dd91.json.ps1`（不建议恢复，否则 git 又会写不进） |
| 技能找不到（warn 技能未挂载） | 移动/重命名了仓库目录，生成物还是旧路径 | 在新位置重新 `npm run install:presets`，再重装 bundle |
| 外部技能没生效 | 映射路径错，或目录里 `SKILL.md` 不在直接子目录 | 路径用绝对路径；DSH 只认目录下「含 SKILL.md 的直接子目录」，深层需平铺 |

---

## 6. 命令速查

```powershell
# 首次 / 换机器
npm ci
npm run install:presets
# → 安装 .generated/dsh-role-presets 到 DSH，开新会话

# 日常改动后
npm test
npm run install:presets
# → 重装 bundle，开新会话

# 调试
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
| `docs/skill-catalog.md` | 外部技能来源、版本 pin、许可 |
| `docs/external-skills.md` | 外部技能清单与本机挂载分离方案 |
| `AGENTS.md` | AI 在本仓库工作的硬约束 |
| `presets/*.yaml` | 四个角色预设声明（你主要改这里） |
| `scripts/install-presets.mjs` | 生成本机 bundle |
| `scripts/render-presets.mjs` | 渲染器（可导入 `renderPresets()`） |
| `external-skills.local.example.yaml` | 外部技能本机映射模板 |
