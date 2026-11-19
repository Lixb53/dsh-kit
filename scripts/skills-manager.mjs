#!/usr/bin/env node
/**
 * 外部技能安装与维护工具。
 *
 * 真源：skills-manifest.json（来源 + 版本 pin，来自 docs/skill-catalog.md）。
 * 下载源：codeload.github.com 的 tag/commit tarball，固定 ref，可复现。
 * 安装到：.generated/external-skills/（gitignore，不入库）。
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
const INSTALL_ROOT = join(REPO_ROOT, '.generated', 'external-skills');
const MOUNT_CONFIG = join(REPO_ROOT, 'external-skills.local.yaml');
const TMP_DIR = join(REPO_ROOT, '.generated', '.tmp');

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
// 挂载配置生成
// ---------------------------------------------------------------------------

function generateMountConfig(manifest) {
  // 一条安装根整体暴露；为了角色隔离，按预设把需要的技能平铺到各自的根。
  // 布局：.generated/external-skills/<preset>/<skill-name>/SKILL.md
  // 先清空所有 preset 根，保证 remove 后 sync 不会残留已删除技能的副本。
  for (const preset of ['product-design', 'ui-design', 'frontend-dev', 'backend-dev']) {
    rmSync(join(INSTALL_ROOT, preset), { recursive: true, force: true });
  }
  for (const p of manifest.packages) {
    if (p.kind !== 'auto') continue;
    const info = installedVersion(p);
    if (!info || info.ref !== p.ref) continue;
    for (const preset of p.presets) {
      for (const e of p.entries) {
        const src = join(pkgDir(p), e.src);
        const dst = join(INSTALL_ROOT, preset, e.name);
        if (!hasSkillMd(src)) continue;
        mkdirSync(dirname(dst), { recursive: true });
        rmSync(dst, { recursive: true, force: true });
        cpDirSync(src, dst);
      }
    }
  }

  const lines = ['# 由 scripts/skills-manager.mjs sync 生成；请勿手改（改了会被覆盖）。'];
  for (const preset of ['product-design', 'ui-design', 'frontend-dev', 'backend-dev']) {
    const root = join(INSTALL_ROOT, preset);
    if (existsSync(root)) lines.push('', `${preset}:`, `  - '${root}'`);
  }
  writeFileSync(MOUNT_CONFIG, `${lines.join('\n')}\n`, 'utf8');
  console.log(`✓ 已生成挂载配置 ${MOUNT_CONFIG}`);
}

function cpDirSync(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
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
      if (!existsSync(MOUNT_CONFIG)) {
        console.log('挂载配置不存在：运行 sync 生成。');
      } else {
        console.log(readFileSync(MOUNT_CONFIG, 'utf8'));
      }
      break;
    }
    case 'doctor': {
      let problems = 0;
      for (const p of manifest.packages) {
        if (p.kind !== 'auto') continue;
        const info = installedVersion(p);
        if (!info || info.ref !== p.ref) {
          console.log(`  ✗ ${p.id}: 未安装或版本不符 (期望 ${p.ref})`);
          problems += 1;
          continue;
        }
        for (const e of p.entries) {
          if (!hasSkillMd(join(pkgDir(p), e.src))) {
            console.log(`  ✗ ${p.id}: 入口 ${e.src} 缺 SKILL.md`);
            problems += 1;
          }
        }
      }
      console.log(problems ? `\n✗ 发现 ${problems} 个问题` : '\n✓ 全部 auto 技能安装完整');
      break;
    }
    default:
      console.log(`用法: node scripts/skills-manager.mjs <list|install|update|remove|sync|status|doctor> [id...]`);
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
