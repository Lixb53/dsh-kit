#!/usr/bin/env node
/**
 * 校验 presets → cordis.patch.yml 的渲染结果（需要 js-yaml）。
 *
 * 检查：
 *  1. 渲染输出是合法 YAML，顶层为 `- insert: [...]`
 *  2. 每个预设条目有 id / name / description / plugins
 *  3. 每个预设都挂了 persona、skill-filesystem、tool-skill
 *  4. 声明了 critic.enabled 的预设，对应 critic 预设存在，且 tool-fs 为只读
 *  5. critic 预设的 id 唯一，且以 `-critic` 结尾
 *  6. 技能隔离：预设只挂载它引用的技能所在分组，不挂无关分组
 *  7. 预设 id 与 presets/*.yaml 文件一一对应
 *
 * 用法：node scripts/check-render.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();

let yaml;
try {
  yaml = require('js-yaml');
} catch {
  console.error('✗ 缺少 js-yaml：请先运行 npm install（CI 中由 npm install 提供）');
  process.exit(1);
}

const errors = [];
const err = (m) => errors.push(m);

const presetsDir = join(root, 'presets');

/** 从 YAML 文本里取某个顶层 key 的列表项。 */
function parseYamlList(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  if (start === -1) return null;
  const items = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line)) break;
    const m = line.match(/^\s*-\s+(.+?)\s*$/);
    if (m) items.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return items;
}

// 1. 渲染
let rendered;
try {
  rendered = execFileSync(
    process.execPath,
    [join(root, 'scripts', 'render-presets.mjs'), '--root', root],
    { encoding: 'utf8' },
  );
} catch (e) {
  console.error(`✗ 渲染失败：${e.message}`);
  process.exit(1);
}

// 2. 解析
let doc;
try {
  doc = yaml.load(rendered);
} catch (e) {
  console.error(`✗ 渲染输出不是合法 YAML：${e.message}`);
  process.exit(1);
}

if (!Array.isArray(doc) || doc.length === 0) {
  console.error('✗ 渲染输出顶层应为非空数组');
  process.exit(1);
}
const insert = doc[0]?.insert;
if (!Array.isArray(insert) || insert.length === 0) {
  console.error('✗ 渲染输出缺少 `- insert:` 列表');
  process.exit(1);
}

// 3. 索引条目
const byId = new Map();
for (const entry of insert) {
  const id = entry?.id;
  if (!id) {
    err('存在没有 id 的条目');
    continue;
  }
  if (byId.has(id)) err(`条目 id 重复：${id}`);
  byId.set(id, entry);
}

// 4. 逐条检查
const presetIds = new Set();
for (const [id, entry] of byId) {
  const cfg = entry.config;
  if (!cfg) {
    err(`${id}: 缺少 config`);
    continue;
  }
  if (!cfg.id) err(`${id}: config 缺少 id`);
  if (!cfg.name) err(`${id}: config 缺少 name`);
  if (!cfg.description) err(`${id}: config 缺少 description`);
  if (!Array.isArray(cfg.plugins) || cfg.plugins.length === 0) {
    err(`${id}: config.plugins 为空`);
    continue;
  }

  const pluginIds = cfg.plugins.map((p) => p.id);
  for (const required of ['persona', 'skill-filesystem', 'tool-skill']) {
    if (!pluginIds.includes(required)) err(`${id}: 缺少插件 ${required}`);
  }

  const fsPlugin = cfg.plugins.find((p) => p.id === 'skill-filesystem');
  const dirs = fsPlugin?.config?.customSkillDirs;
  if (!Array.isArray(dirs) || dirs.length === 0) {
    err(`${id}: skill-filesystem.customSkillDirs 为空`);
  }

  const persona = cfg.plugins.find((p) => p.id === 'persona');
  if (!persona?.config?.prefix || String(persona.config.prefix).trim() === '') {
    err(`${id}: persona.prefix 为空`);
  }

  if (id.endsWith('-critic')) {
    const toolFs = cfg.plugins.find((p) => p.id === 'tool-fs');
    if (!toolFs) {
      err(`${id}: 只读评审预设缺少 tool-fs`);
    } else if (toolFs.config?.write !== false || toolFs.config?.edit !== false) {
      err(`${id}: 只读评审预设的 tool-fs 必须 write:false / edit:false`);
    }
    if (cfg.plugins.some((p) => p.id === 'tool-pwsh' || p.id === 'tool-bash')) {
      err(`${id}: 只读评审预设不应挂载 shell 工具`);
    }
  } else {
    presetIds.add(cfg.id);
  }
}

// 5. critic 引用存在
for (const [id, entry] of byId) {
  const cfg = entry.config;
  const critic = cfg?.plugins?.find((p) => p.id === 'critic');
  if (!critic) continue;
  const target = critic.config?.agentPreset;
  if (!target) {
    err(`${id}: critic 插件缺少 agentPreset`);
  } else if (!byId.has(`preset-${target}`)) {
    err(`${id}: critic 引用了不存在的预设 ${target}`);
  }
  const targetCfg = byId.get(`preset-${target}`)?.config;
  if (targetCfg && targetCfg.plugins?.some((p) => p.id === 'tool-pwsh')) {
    err(`${id}: critic 目标预设 ${target} 挂了 shell 工具`);
  }
}

// 5b. 技能隔离：预设挂载的分组必须恰好覆盖它引用的技能所在分组
const skillsRoot = join(root, 'skills');
const groupSkills = new Map(); // group -> Set(skillName)
if (existsSync(skillsRoot)) {
  for (const group of readdirSync(skillsRoot)) {
    const groupPath = join(skillsRoot, group);
    if (!statSync(groupPath).isDirectory() || group.startsWith('.')) continue;
    const names = new Set();
    for (const name of readdirSync(groupPath)) {
      const skillDir = join(groupPath, name);
      if (!statSync(skillDir).isDirectory() || name.startsWith('.')) continue;
      if (existsSync(join(skillDir, 'SKILL.md'))) names.add(name);
    }
    if (names.size > 0) groupSkills.set(group, names);
  }
}

for (const file of readdirSync(presetsDir).filter((n) => /\.ya?ml$/.test(n))) {
  const id = basename(file).replace(/\.(ya?ml)$/, '');
  const entry = byId.get(`preset-${id}`);
  if (!entry) continue;

  const text = readFileSync(join(presetsDir, file), 'utf8');
  const refs = parseYamlList(text, 'skills') ?? [];
  const expectedGroups = new Set();
  for (const ref of refs) {
    for (const [group, names] of groupSkills) {
      if (names.has(ref)) expectedGroups.add(group);
    }
  }

  const dirs = entry.config.plugins.find((p) => p.id === 'skill-filesystem')?.config
    ?.customSkillDirs;
  if (!Array.isArray(dirs)) continue;

  const mountedGroups = dirs.map((d) => basename(d.replace(/[\\/]+$/, '')));
  const mountedSet = new Set(mountedGroups);

  for (const g of mountedSet) {
    if (!expectedGroups.has(g)) {
      err(
        `${id}: 挂载了与预设无关的技能分组 "${g}"（该预设只引用 ${refs.join(', ') || '无'}）`,
      );
    }
  }
  for (const g of expectedGroups) {
    if (!mountedSet.has(g)) {
      err(`${id}: 引用的技能在分组 "${g}"，但未挂载该分组`);
    }
  }
}

// 6. 与 presets/ 文件对齐
const files = existsSync(presetsDir)
  ? readdirSync(presetsDir)
      .filter((n) => /\.ya?ml$/.test(n))
      .map((n) => basename(n).replace(/\.(ya?ml)$/, ''))
  : [];

for (const f of files) {
  if (!presetIds.has(f)) err(`presets/${f}.yaml 未出现在渲染结果中`);
}
for (const id of presetIds) {
  if (!files.includes(id)) err(`渲染结果中的预设 ${id} 没有对应的 presets/${id}.yaml`);
}

// 输出
if (errors.length > 0) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\n✗ 渲染检查失败：${errors.length} 个错误`);
  process.exit(1);
}

console.log(
  `✓ 渲染检查通过：${presetIds.size} 个预设，${insert.length - presetIds.size} 个评审预设，${insert.length} 个条目`,
);
