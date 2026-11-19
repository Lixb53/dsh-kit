#!/usr/bin/env node
/**
 * dsh-kit 校验器（零依赖）。
 *
 * 检查项：
 *  1. skills/<name>/SKILL.md 存在，且以 --- 开头的 YAML frontmatter
 *  2. frontmatter 含 name、description；name 与目录名一致且为 lowercase kebab-case
 *  3. description 长度 1–1024
 *  4. presets/*.yaml 的 id 与文件名一致，skills: 引用的技能全部存在
 *  5. CHANGELOG.md 含 "## [Unreleased]"
 *  6. version.txt 与 .release-please-manifest.json 的版本一致
 *
 * 用法：node scripts/validate-skills.mjs [repoRoot]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = process.argv[2] ? process.argv[2] : process.cwd();
const errors = [];
const warnings = [];

const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readText(path) {
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
}

/** 解析 SKILL.md 的 frontmatter，只取单行 key: value。 */
function parseFrontmatter(text, where) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) {
    err(`${where}: 缺少以 --- 开头的 YAML frontmatter`);
    return { data: {}, body: text };
  }
  const data = {};
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: text.slice(m[0].length) };
}

/** 从 YAML 文本里取某个顶层 key 的列表项。 */
function parseYamlList(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  if (start === -1) return null;
  const items = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // 回到顶层 key
    const m = line.match(/^\s*-\s+(.+?)\s*$/);
    if (m) items.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return items;
}

function parseYamlScalar(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

// ---------------------------------------------------------------------------
// 1–3. 技能
// ---------------------------------------------------------------------------

const skillsDir = join(root, 'skills');
const skillNames = new Set();

if (!existsSync(skillsDir)) {
  err('缺少 skills/ 目录');
} else {
  const entries = readdirSync(skillsDir).filter((name) => {
    const p = join(skillsDir, name);
    return statSync(p).isDirectory() && !name.startsWith('.');
  });

  if (entries.length === 0) err('skills/ 下没有任何技能目录');

  for (const dirName of entries.sort()) {
    const skillPath = join(skillsDir, dirName, 'SKILL.md');
    const where = `skills/${dirName}/SKILL.md`;

    if (!existsSync(skillPath)) {
      err(`${where}: 缺少 SKILL.md`);
      continue;
    }

    const text = readText(skillPath);
    const { data, body } = parseFrontmatter(text, where);

    if (!data.name) err(`${where}: frontmatter 缺少 name`);
    if (!data.description) err(`${where}: frontmatter 缺少 description`);

    if (data.name) {
      if (!KEBAB.test(data.name)) {
        err(`${where}: name "${data.name}" 不是 lowercase kebab-case`);
      }
      if (data.name !== dirName) {
        err(`${where}: name "${data.name}" 与目录名 "${dirName}" 不一致`);
      }
      if (skillNames.has(data.name)) {
        err(`${where}: 技能名 "${data.name}" 重复`);
      }
      skillNames.add(data.name);
    }

    if (data.description) {
      const len = [...data.description].length;
      if (len < 1 || len > 1024) {
        err(`${where}: description 长度 ${len}，应在 1–1024 字符之间`);
      }
    }

    if (body.trim().length === 0) {
      err(`${where}: 正文为空`);
    } else if (body.length > 20000) {
      warn(`${where}: 正文 ${body.length} 字符，建议拆分或把细节移入 references/`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. 预设
// ---------------------------------------------------------------------------

const presetsDir = join(root, 'presets');
if (!existsSync(presetsDir)) {
  err('缺少 presets/ 目录');
} else {
  const presets = readdirSync(presetsDir).filter((n) => n.endsWith('.yaml') || n.endsWith('.yml'));

  if (presets.length === 0) err('presets/ 下没有任何预设');

  for (const file of presets.sort()) {
    const where = `presets/${file}`;
    const text = readText(join(presetsDir, file));
    const id = parseYamlScalar(text, 'id');
    const expected = basename(file).replace(/\.(ya?ml)$/, '');

    if (!id) err(`${where}: 缺少 id`);
    else if (id !== expected) err(`${where}: id "${id}" 与文件名 "${expected}" 不一致`);

    if (!parseYamlScalar(text, 'name')) err(`${where}: 缺少 name`);
    if (!parseYamlScalar(text, 'persona')) err(`${where}: 缺少 persona`);

    const refs = parseYamlList(text, 'skills');
    if (refs === null) {
      err(`${where}: 缺少 skills: 列表`);
    } else {
      if (refs.length === 0) err(`${where}: skills: 为空`);
      for (const ref of new Set(refs)) {
        if (!skillNames.has(ref)) {
          err(`${where}: skills 引用了不存在的技能 "${ref}"`);
        }
      }
    }

    const deliverables = parseYamlList(text, 'deliverables');
    if (!deliverables || deliverables.length === 0) {
      err(`${where}: 缺少 deliverables: 列表`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. CHANGELOG
// ---------------------------------------------------------------------------

const changelogPath = join(root, 'CHANGELOG.md');
if (!existsSync(changelogPath)) {
  err('缺少 CHANGELOG.md');
} else if (!/^## \[Unreleased\]/m.test(readText(changelogPath))) {
  err('CHANGELOG.md: 缺少 "## [Unreleased]" 段落');
}

// ---------------------------------------------------------------------------
// 6. 版本一致性
// ---------------------------------------------------------------------------

const versionPath = join(root, 'version.txt');
const manifestPath = join(root, '.release-please-manifest.json');
if (existsSync(versionPath) && existsSync(manifestPath)) {
  try {
    const version = readText(versionPath).trim();
    const manifest = JSON.parse(readText(manifestPath));
    if (manifest['.'] !== version) {
      err(`version.txt (${version}) 与 .release-please-manifest.json (${manifest['.']}) 不一致`);
    }
  } catch (e) {
    err(`版本文件解析失败: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

const skillCount = skillNames.size;
const presetCount = existsSync(presetsDir)
  ? readdirSync(presetsDir).filter((n) => /\.ya?ml$/.test(n)).length
  : 0;

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

if (errors.length > 0) {
  console.error(`\n✗ 校验失败：${errors.length} 个错误，${warnings.length} 个警告`);
  process.exit(1);
}

console.log(`✓ 校验通过：${skillCount} 个技能，${presetCount} 个预设，${warnings.length} 个警告`);
