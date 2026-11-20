#!/usr/bin/env node
/**
 * 外部技能安装与维护工具。
 *
 * 真源：skills-manifest.json（来源 + 版本 pin，来自 docs/skill-catalog.md）。
 * 下载源：codeload.github.com 的 tag/commit tarball，固定 ref，可复现。
 *
 * 磁盘布局：下载物与挂载点**分两层**，互不混放（都在 gitignore 的 .generated/ 下）
 *   .generated/external-skills/<包id>/          每个包的原始文件，含 .dsh-source.json，不被挂载
 *   .generated/preset-skills/<预设id>/<技能名>/  该预设可见的技能，customSkillDirs 指向这一层
 * 挂载点是「按预设」的隔离单元：一个预设一个目录，绝不把同一目录配给多个预设。
 * 挂载映射：sync 生成 external-skills.local.yaml（gitignore），供 install:presets 渲染。
 *
 * 命令：
 *   node scripts/skills-manager.mjs list                 列出清单及安装状态
 *   node scripts/skills-manager.mjs install [id...]       安装（默认全部 auto）
 *   node scripts/skills-manager.mjs update  [id...]       重装（同 install，覆盖到 pin 版本）
 *   node scripts/skills-manager.mjs remove  <id...>       删除已安装目录
 *   node scripts/skills-manager.mjs status                显示挂载配置状态
 *   node scripts/skills-manager.mjs sync                  重建 external-skills.local.yaml
 *   node scripts/skills-manager.mjs doctor                自检：安装完整性与 SKILL.md 落点
 *
 * 跨平台：全程 node 内置 API + tar（系统自带），不依赖 curl/pwsh；Windows/macOS/Linux 通用。
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
  renameSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const MANIFEST = join(REPO_ROOT, 'skills-manifest.json');
/** 下载物：每个包一份，不挂载。 */
const INSTALL_ROOT = join(REPO_ROOT, '.generated', 'external-skills');
/** 挂载点：每个预设一份，只放该预设可见的技能。 */
const MOUNT_ROOT = join(REPO_ROOT, '.generated', 'preset-skills');
const PRESETS_DIR = join(REPO_ROOT, 'presets');
const MOUNT_CONFIG = join(REPO_ROOT, 'external-skills.local.yaml');
const TMP_DIR = join(REPO_ROOT, '.generated', '.tmp');
/** 复制技能时永不搬运的条目：版本库元数据与自身元数据不属于技能正文。 */
const SKIP_COPY = new Set(['.git', '.dsh-source.json']);

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

function pkg(id, manifest) {
  const found = manifest.packages.find((p) => p.id === id);
  if (!found) throw new Error(`清单中没有技能 id: ${id}`);
  return found;
}

function pkgDir(p) {
  return join(INSTALL_ROOT, p.id);
}

function installedVersion(p) {
  const f = join(pkgDir(p), '.dsh-source.json');
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

function hasSkillMd(dir) {
  return existsSync(join(dir, 'SKILL.md'));
}

/** 已安装且 ref 与清单一致。 */
function isInstalledCurrent(p) {
  const info = installedVersion(p);
  return Boolean(info) && info.ref === p.ref;
}

function mountDir(preset) {
  return join(MOUNT_ROOT, preset);
}

/**
 * 读取 presets/*.yaml 的 id 与 external_skills 声明（只认顶层 key，够用即可）。
 * 预设清单的真源是 presets/ 目录本身：新增/改名预设后无需改本脚本。
 */
function loadPresets() {
  const out = new Map();
  if (!existsSync(PRESETS_DIR)) return out;
  for (const file of readdirSync(PRESETS_DIR).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const text = readFileSync(join(PRESETS_DIR, file), 'utf8');
    const id = text.match(/^id:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (!id) continue;
    out.set(id, { file, externalSkills: topLevelList(text, 'external_skills') });
  }
  return out;
}

/** 取顶层 `key:` 下的列表项（只取到下一个顶层 key 为止）。 */
function topLevelList(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  if (start === -1) return [];
  const items = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line)) break;
    const m = line.match(/^\s*-\s+(.+?)\s*$/);
    if (m) items.push(m[1].replace(/^["']|["']$/g, '').replace(/\s+#.*$/, ''));
  }
  return items;
}

// ---------------------------------------------------------------------------
// 下载：用 git fetch 固定 ref（tag 或 commit SHA）。git 自带代理配置与凭据，
// 比 node fetch 更可靠（沙箱/代理环境下 fetch 常被拦，git 能走用户 gitconfig）。
// ---------------------------------------------------------------------------

function runGit(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args[0]} 失败: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}

function fetchRepo(p, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  runGit(['init', '-q'], dest);
  runGit(['remote', 'add', 'origin', `https://github.com/${p.repo}.git`], dest);
  // --depth 1 固定 ref：tag 和 40 位 commit SHA 都支持，可复现。
  runGit(['fetch', '-q', '--depth', '1', 'origin', p.ref], dest);
  runGit(['checkout', '-q', 'FETCH_HEAD'], dest);
  return dest;
}

function installPackage(p) {
  if (p.kind !== 'auto') {
    console.log(`  skip  ${p.id}：kind=manual，按 docs/skill-catalog.md 手动安装`);
    return;
  }
  const dir = pkgDir(p);
  const unpack = join(TMP_DIR, `${p.id}-repo`);

  console.log(`  ↓ ${p.id}  ${p.repo}@${p.ref}`);
  const srcRoot = fetchRepo(p, unpack);

  // 校验每个 entry 的 SKILL.md 存在，避免装了空壳
  for (const e of p.entries) {
    if (!hasSkillMd(join(srcRoot, e.src))) {
      throw new Error(`${p.id}: 入口 ${e.src} 下没有 SKILL.md（ref=${p.ref}，路径可能已变化）`);
    }
  }

  // 只复制需要的 entry 子树到新目录，不搬运 .git（ Windows 上对只读对象的 rename 会 EPERM）。
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const e of p.entries) {
    cpDirSync(join(srcRoot, e.src), join(dir, e.src));
  }
  writeFileSync(
    join(dir, '.dsh-source.json'),
    `${JSON.stringify({ id: p.id, repo: p.repo, ref: p.ref, installedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );
  console.log(`  ✓ ${p.id} 已安装 (${p.entries.length} 个技能)`);
}

// ---------------------------------------------------------------------------
// 挂载：先算计划并校验，再整体重建挂载根
// ---------------------------------------------------------------------------

/**
 * 由清单 + presets/ 算出「哪个预设能看到哪些技能」。
 * 只做计算与校验，不动磁盘：有冲突时调用方可以安全中止。
 */
function planMounts(manifest, presets) {
  const plan = [];
  const errors = [];
  const warnings = [];
  const owner = new Map(); // `${preset}/${name}` -> 包 id

  for (const p of manifest.packages) {
    if (p.kind !== 'auto') continue;
    if (!isInstalledCurrent(p)) {
      warnings.push(
        `${p.id}: 未安装或版本不符（期望 ${p.ref}），本次不挂载（先运行 install/update ${p.id}）`,
      );
      continue;
    }
    const targets = Array.isArray(p.presets) ? p.presets : [];
    if (targets.length === 0) {
      warnings.push(`${p.id}: 清单未声明 presets，本次不挂载`);
      continue;
    }
    for (const preset of targets) {
      if (!presets.has(preset)) {
        errors.push(
          `${p.id}: 清单指向的预设 "${preset}" 不存在（presets/${preset}.yaml 没有这个 id）`,
        );
        continue;
      }
      for (const e of Array.isArray(p.entries) ? p.entries : []) {
        const src = join(pkgDir(p), e.src);
        if (!hasSkillMd(src)) {
          errors.push(`${p.id}: 入口 ${e.src} 下没有 SKILL.md（先运行 update ${p.id}）`);
          continue;
        }
        const key = `${preset}/${e.name}`;
        if (owner.has(key)) {
          errors.push(
            `技能名冲突：预设 ${preset} 下的 "${e.name}" 同时来自 ${owner.get(key)} 与 ${p.id}`,
          );
          continue;
        }
        owner.set(key, p.id);
        plan.push({ preset, name: e.name, src, pkg: p.id });
      }
    }
  }
  return { plan, errors, warnings };
}

/**
 * 整体重建 .generated/preset-skills/<预设>/ 并生成 external-skills.local.yaml。
 * 全删全建：remove / 改 presets 之后不会残留旧技能，也不会让下载物与挂载点同名打架。
 */
function generateMountConfig(manifest) {
  const presets = loadPresets();
  if (presets.size === 0) throw new Error(`presets/ 下没有可识别的预设：${PRESETS_DIR}`);

  const { plan, errors, warnings } = planMounts(manifest, presets);
  for (const w of warnings) console.warn(`  warn  ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`  error ${e}`);
    throw new Error(`挂载计划有 ${errors.length} 个错误，已中止（磁盘未改动）`);
  }

  rmSync(MOUNT_ROOT, { recursive: true, force: true });
  for (const item of plan) cpDirSync(item.src, join(mountDir(item.preset), item.name));

  // 清掉旧布局残留：早期版本把挂载点放在 .generated/external-skills/<预设>/ 下。
  // 只删「名字等于预设 id 且没有 .dsh-source.json」的目录，不会误删下载物。
  const legacy = [];
  if (existsSync(INSTALL_ROOT)) {
    for (const name of readdirSync(INSTALL_ROOT)) {
      const dir = join(INSTALL_ROOT, name);
      if (presets.has(name) && statSync(dir).isDirectory() && !existsSync(join(dir, '.dsh-source.json'))) {
        rmSync(dir, { recursive: true, force: true });
        legacy.push(name);
      }
    }
  }

  const byPreset = new Map();
  for (const item of plan) {
    if (!byPreset.has(item.preset)) byPreset.set(item.preset, []);
    byPreset.get(item.preset).push(item.name);
  }

  // 只给有技能的预设写挂载根：空目录不写，避免 customSkillDirs 指向不存在的位置。
  const mounted = [...byPreset.keys()].sort();
  const lines = [
    '# 由 scripts/skills-manager.mjs sync 生成；请勿手改（改了会被覆盖）。',
    '# 一个预设一个挂载根：不要把同一个目录配给多个预设，否则技能会互相污染。',
    `# 布局：${join(MOUNT_ROOT, '<预设id>', '<技能名>', 'SKILL.md')}`,
  ];
  for (const preset of mounted) {
    lines.push('', `${preset}:`, `  - '${mountDir(preset)}'`);
  }
  writeFileSync(MOUNT_CONFIG, `${lines.join('\n')}\n`, 'utf8');

  for (const preset of mounted) {
    console.log(
      `  ✓ ${preset.padEnd(16)} ${String(byPreset.get(preset).length).padStart(2)} 个技能  ${mountDir(preset)}`,
    );
  }
  for (const preset of presets.keys()) {
    if (!byPreset.has(preset)) {
      console.log(`  · ${preset.padEnd(16)}  0 个技能（只用仓库内 skills/ 分组）`);
    }
  }
  console.log(`\n✓ 已重建挂载根 ${MOUNT_ROOT}`);
  console.log(`✓ 已生成挂载映射 ${MOUNT_CONFIG}`);
  if (legacy.length > 0) {
    console.log(`✓ 已清理旧布局残留（${INSTALL_ROOT} 下的挂载根）：${legacy.join(', ')}`);
  }
}

function cpDirSync(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP_COPY.has(name)) continue;
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) cpDirSync(s, d);
    else {
      // 跳过上游可能存在的符号链接目标文件
      try { writeFileSync(d, readFileSync(s)); } catch { /* skip unreadable */ }
    }
  }
}

// ---------------------------------------------------------------------------
// 命令
// ---------------------------------------------------------------------------

const [cmd, ...ids] = process.argv.slice(2);

try {
  const manifest = loadManifest();
  switch (cmd) {
    case 'list': {
      console.log('外部技能清单（来源：skills-manifest.json / docs/skill-catalog.md）\n');
      for (const p of manifest.packages) {
        const info = installedVersion(p);
        const state = p.kind === 'manual'
          ? 'manual'
          : info ? (info.ref === p.ref ? 'installed' : `outdated(${info.ref})`) : 'not installed';
        console.log(`  ${p.id.padEnd(22)} ${state.padEnd(18)} ${p.repo}@${p.ref}`);
        console.log(`      ${p.label}`);
      }
      break;
    }
    case 'install':
    case 'update': {
      const targets = ids.length ? ids : manifest.packages.filter((p) => p.kind === 'auto').map((p) => p.id);
      console.log(`安装 ${targets.length} 个包到 ${INSTALL_ROOT}\n`);
      for (const id of targets) installPackage(pkg(id, manifest));
      console.log('\n安装完成。运行 sync 更新挂载配置，再运行 npm run install:presets 重新生成 bundle。');
      break;
    }
    case 'remove': {
      if (!ids.length) throw new Error('remove 需要至少一个技能 id');
      for (const id of ids) {
        pkg(id, manifest); // 校验 id 存在
        const dir = pkgDir({ id });
        rmSync(dir, { recursive: true, force: true });
        console.log(`  ✓ 已删除 ${id}`);
      }
      console.log('\n运行 sync 重建挂载配置。');
      break;
    }
    case 'sync': {
      generateMountConfig(manifest);
      break;
    }
    case 'status': {
      const presets = loadPresets();
      if (!existsSync(MOUNT_CONFIG)) {
        console.log(`挂载映射不存在：运行 sync 生成（预期位置 ${MOUNT_CONFIG}）。`);
      } else {
        console.log(readFileSync(MOUNT_CONFIG, 'utf8'));
      }
      console.log(`挂载根：${MOUNT_ROOT}`);
      for (const preset of presets.keys()) {
        const dir = mountDir(preset);
        const skills = existsSync(dir)
          ? readdirSync(dir).filter((n) => hasSkillMd(join(dir, n))).sort()
          : [];
        console.log(
          `  ${preset.padEnd(16)} ${String(skills.length).padStart(2)} 个技能${skills.length ? `：${skills.join(', ')}` : ''}`,
        );
      }
      break;
    }
    case 'doctor': {
      const presets = loadPresets();
      const problems = [];
      const warns = [];
      const { plan, errors, warnings } = planMounts(manifest, presets);
      problems.push(...errors);
      warns.push(...warnings);

      // 1. 安装状态
      for (const p of manifest.packages) {
        if (p.kind !== 'auto') continue;
        if (!isInstalledCurrent(p)) problems.push(`${p.id}: 未安装或版本不符（期望 ${p.ref}）`);
      }

      // 1b. 下载物目录里不该出现「不是包」的东西（旧布局把挂载点塞在这里）
      if (existsSync(INSTALL_ROOT)) {
        const known = new Set(manifest.packages.map((p) => p.id));
        for (const name of readdirSync(INSTALL_ROOT)) {
          if (!known.has(name) && statSync(join(INSTALL_ROOT, name)).isDirectory()) {
            problems.push(`${name}: ${INSTALL_ROOT} 下的非清单目录（旧布局残留？运行 sync 或手动删除）`);
          }
        }
      }

      // 2. 挂载点是否与计划一致（每个预设只看得到自己的技能）
      const expected = new Map();
      for (const item of plan) {
        if (!expected.has(item.preset)) expected.set(item.preset, new Set());
        expected.get(item.preset).add(item.name);
      }
      for (const [preset, names] of expected) {
        for (const name of names) {
          const dir = join(mountDir(preset), name);
          if (!hasSkillMd(dir)) {
            problems.push(`${preset}/${name}: 挂载点缺 SKILL.md（运行 sync 重建）`);
          } else if (existsSync(join(dir, '.git'))) {
            problems.push(`${preset}/${name}: 技能目录里含 .git（旧版复制残留，运行 sync 清理）`);
          }
        }
      }

      // 3. 挂载根里的残留（预设改名/删除后没 sync 的痕迹）
      if (existsSync(MOUNT_ROOT)) {
        for (const preset of readdirSync(MOUNT_ROOT)) {
          const dir = join(MOUNT_ROOT, preset);
          if (!statSync(dir).isDirectory()) {
            problems.push(`${MOUNT_ROOT} 下出现非目录条目 ${preset}`);
            continue;
          }
          const want = expected.get(preset);
          if (!want) {
            problems.push(`${preset}: 挂载根存在但不在计划内（预设已删/改名？运行 sync 清理）`);
            continue;
          }
          for (const name of readdirSync(dir)) {
            if (!want.has(name)) problems.push(`${preset}/${name}: 计划外的技能目录（运行 sync 清理）`);
          }
        }
      }

      // 4. 声明漂移：清单把包挂到某预设，但预设的 external_skills 没提到它
      for (const p of manifest.packages) {
        if (p.kind !== 'auto' || !isInstalledCurrent(p)) continue;
        for (const preset of p.presets ?? []) {
          const meta = presets.get(preset);
          if (!meta) continue;
          const known = new Set([p.id, ...(p.entries ?? []).map((e) => e.name)]);
          if (!meta.externalSkills.some((d) => known.has(d))) {
            warns.push(
              `${p.id}: 会挂载到预设 ${preset}，但 presets/${meta.file} 的 external_skills 没提到它（角色提示词里也就不会提）`,
            );
          }
        }
      }

      for (const w of warns) console.log(`  warn  ${w}`);
      for (const problem of problems) console.log(`  ✗ ${problem}`);
      console.log(
        problems.length
          ? `\n✗ 发现 ${problems.length} 个问题，${warns.length} 个警告`
          : `\n✓ 安装与挂载一致：${plan.length} 个挂载技能，${warns.length} 个警告`,
      );
      if (problems.length > 0) process.exitCode = 1;
      break;
    }
    default:
      console.log(
        `用法: node scripts/skills-manager.mjs <list|install|update|remove|sync|status|doctor> [id...]`,
      );
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
