# 外部技能：只维护清单，不复制正文

本仓库把「流程与门禁技能」和「外部知识技能包」分开管理，见 [`skill-catalog.md`](skill-catalog.md) 与 [`presets.md`](presets.md) 的 `external_skills` 字段。原则：

> **技能正文的单一真源在仓库内只属于 `skills/`；外部包的代码与 `SKILL.md` 一律不进版本库。** 仓库里只维护「声明（用哪个包、哪个版本、什么许可）」和「本机怎么装」。

## 为什么要分离

- 外部包由上游维护，复制进 `skills/` 会让你维护一份 fork：上游更新要手动跟、许可与出处要自己盯、还可能与本仓库的两级目录/校验规则冲突。
- 但「声明了却装不上」更糟：本仓库渲染时 `includeDefaultRoots: false`，预设**只看得到** `customSkillDirs` 指向的目录。写在 `external_skills:` 里的包，如果没有挂载到目录，运行时等于不存在。

所以方案是三段式：**声明在预设 → 来源/版本在 catalog → 安装目录在本机配置**。

## 三段各自放哪

| 段 | 文件 | 是否入库 | 内容 |
|---|---|---|---|
| 声明 | `presets/<id>.yaml` 的 `external_skills:` | 是 | 只用名字引用外部技能，列出本预设需要哪些 |
| 来源与版本 | `docs/skill-catalog.md` | 是 | 仓库 URL、**pin 的 ref**、许可、安装命令、适配要求 |
| 本机挂载 | `external-skills.local.yaml`（默认）或 `--external-config` 指定 | **否**，已加入 `.gitignore` | 把「预设 id」映射到本机的外部技能安装目录 |

## 安装与挂载步骤

### 1. 安装到仓库外的稳定目录

建议统一装在一个不入库的目录，例如 `<你自己的路径>/dsh-external-skills/`。每个包的安装方式见 catalog；对提供 `SKILL.md` 的包，用各自的安装脚本（如 `npx skills add`）装到该目录。

> 安装前按 catalog 的提示读一遍上游 `SKILL.md` 与安装脚本。

### 2. 整理成 DSH 可发现的布局

DSH 的一条 `customSkillDirs` 指向一个目录，并把它下面**每个含 `SKILL.md` 的直接子目录**当作一个技能暴露。因此布局要**按预设分根**：一个预设一个目录，只放该角色该看的技能。

```
<dsh-external-skills>/
├── product-design/            ← product-design 预设的挂载根
│   ├── deliver-prd/SKILL.md
│   └── one-line-prototype/SKILL.md
├── ui-design/                 ← ui-design 预设的挂载根
│   ├── ui-ux-pro-max/SKILL.md
│   └── a11y-core/SKILL.md
└── frontend-dev/              ← frontend-dev 预设的挂载根
    └── core-web-vitals/SKILL.md
```

> 不要把同一个目录配给多个预设：一条 `customSkillDirs` 会整体暴露目录下所有技能，共用就失去角色隔离（后端预设想看 Vue 规则就会看到）。

如果某个上游包把 `SKILL.md` 放在更深的位置（例如 `skills/foo/SKILL.md`），复制时把它平铺成 `<预设根>/foo/SKILL.md`。**不要**指到 `skills/` 那一层中间目录，否则 DSH 看不到 `SKILL.md`。

> 用脚本时不用手做这一步：`npm run skills -- sync` 会按 `skills-manifest.json` 的 `presets` 字段自动平铺到 `.generated/preset-skills/<预设id>/<技能名>/`，原始包留在 `.generated/external-skills/<包id>/` 不挂载。

### 3. 写本机挂载配置

在工程根建 `external-skills.local.yaml`（不入库）。仓库提供了 [模板 `external-skills.local.example.yaml`](../external-skills.local.example.yaml)，复制后按本机路径填写即可：

```bash
copy external-skills.local.example.yaml external-skills.local.yaml   # Windows
# 或 cp external-skills.local.example.yaml external-skills.local.yaml  # POSIX
```

内容形如：

```yaml
# key = 预设 id，value = 该预设要额外挂载的本地外部技能安装目录列表
# 每个预设指向自己的根，不要共用同一目录
ui-design:
  - 'D:\tools\dsh-external-skills\ui-design'
product-design:
  - 'D:\tools\dsh-external-skills\product-design'
frontend-dev:
  - 'D:\tools\dsh-external-skills\frontend-dev'
```

- 多条目录可以挂多个安装根（例如不同来源分开存放）。
- 一个目录会被整体暴露给该预设；若只想给某个预设看其中一部分，就为不同预设准备不同的安装根，分别配置。
- 路径用绝对路径，Windows 反斜杠在 YAML 单引号里无需转义。

### 4. 渲染并核对

```bash
node scripts/render-presets.mjs --out cordis.patch.yml
node scripts/check-render.mjs
```

渲染器会把 `external-skills.local.yaml` 里的目录并进对应预设的 `skill-filesystem.customSkillDirs`；校验器会把这些目录豁免于「技能隔离」检查（因为它们是该预设显式声明的外部挂载）。

- 若某个预设声明了 `external_skills` 但没有对应的本地挂载配置，渲染器会打印 `warn`，提示这些技能本次不会挂载。
- 不配置此文件也能正常渲染和校验：外部技能段会被跳过，预设只挂载仓库内的 `skills/` 分组。

### 5. 团队共享

`external-skills.local.yaml` 因路径因人而异不入库。团队复用时，把 catalog 的安装命令与 pin 的 ref 作为约定写进 README/文档，每个人按同样的 ref 安装、各自填本地路径即可——**共享的是「装哪个版本」，不是「装在哪」**。

## 与 `AGENTS.md` 的关系

`AGENTS.md` 规定「`skills/` 是技能的唯一真源，不得在 `.claude/skills/`、`.codex/skills/` 下放副本」。外部技能不复制进这些目录，而是装到仓库外、通过 `external-skills.local.yaml` 挂载，符合该约束。若日后某个外部包被你深度修改、已变成自己的资产，再按正常流程把它作为新技能收进 `skills/<group>/<name>/SKILL.md`——此时它就不再是「外部技能」，而应从 `external_skills` 声明和 catalog 中移除。
