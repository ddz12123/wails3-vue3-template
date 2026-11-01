#!/usr/bin/env node
/**
 * 模板清理脚本：新项目开工前，删除模板自述文件与本地构建产物。
 *
 * 场景：git clone 或整目录复制模板后，模板自带的说明文档（README、docs/、
 * frontend/README.md）与本机构建产物（bin、.task、.mimosa、node_modules 等）
 * 对新项目没有用处，逐个手删很麻烦；本脚本按清单一键清理，可重复执行（幂等）。
 *
 * 用法：
 *   node scripts/clean.mjs                # 执行清理
 *   node scripts/clean.mjs --dry-run      # 仅预览将删除/改写的文件
 *   node scripts/clean.mjs --remove-github --remove-license
 *
 * 选项：
 *   --dry-run          仅预览，不写入
 *   --keep-readme      保留根目录 README.md（默认改写为极简版）
 *   --remove-github    额外删除 .github/（release CI 与 dependabot，默认保留）
 *   --remove-license   额外删除 LICENSE（默认保留，init.mjs 会替换其中的占位版权）
 *   --remove-scripts   额外删除 scripts/（需在 init.mjs 之后执行）
 *   --help             显示帮助
 *
 * 建议流程：clean → init → （可选）clean --remove-scripts → git init → wails3 dev
 */
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 目录型垃圾：存在即整目录删除（[相对路径, 说明]） */
const JUNK_DIRS = [
  ['docs', '模板自述：可选功能示例'],
  ['bin', '本地构建产物'],
  ['.task', 'Task 运行缓存'],
  ['.mimosa', 'AI 工具本地状态'],
  ['.codebuddy', 'AI 工具本地状态'],
  ['.zcode', 'AI 工具本地状态'],
  ['.idea', 'IDE 个人配置'],
  ['.pnpm-store', 'pnpm 本地缓存'],
  ['temp', '临时目录'],
  ['frontend/coverage', '测试覆盖率报告'],
  ['frontend/node_modules', '前端依赖（pnpm install 可复原）'],
  ['build/android/.gradle', 'Android 构建缓存'],
  ['build/android/build', 'Android 构建产物'],
  ['build/android/app/build', 'Android 构建产物'],
  ['build/android/gen', 'Android 生成代码（按机生成）'],
  ['build/ios/xcode/gen', 'iOS 生成代码（按机生成）'],
  ['build/ios/DerivedData', 'iOS 真机调试输出'],
  ['build/linux/appimage/build', 'AppImage 构建产物'],
];

/** 文件型垃圾：存在即删除 */
const JUNK_FILES = [
  ['frontend/README.md', '模板自述（指向根 README）'],
  ['changeme.exe', '本地调试产物'],
  ['build/windows/nsis/MicrosoftEdgeWebview2Setup.exe', 'WebView2 运行时（打包时自动重新下载）'],
  ['build/android/overlay.json', 'Android 按机生成覆盖'],
  ['build/android/local.properties', 'Android 本机 SDK 路径'],
  ['build/ios/xcode/overlay.json', 'iOS 按机生成覆盖'],
];

/** 根目录散落垃圾（对应 .gitignore 的本机产物） */
const ROOT_FILE_PATTERNS = [
  [/^\.DS_Store$/, '系统垃圾文件'],
  [/^Thumbs\.db$/, '系统垃圾文件'],
  [/^.+\.log$/, '日志文件'],
  [/^.+\.syso$/, 'Go 版本信息资源（构建生成）'],
  [/^.+\.out$/, '测试/性能分析产物'],
  [/^.+\.prof$/, '性能分析产物'],
  [/^.+\.test$/, 'go test 编译产物'],
  [/^__debug_bin.*$/, '调试器临时产物'],
];

/** frontend/.env.local 与 .env.<mode>.local 本地覆盖 */
const FRONTEND_ENV_LOCAL = /^\.env(\.[^.]+)?\.local$/;

/** 新项目极简 README（内容与脚本内置保持一致以判断幂等；不得包含模板占位词，否则 init 替换后会重复改写） */
const README_STUB = `# 项目名称

Wails 3 + Vue 3 桌面应用。

## 快速开始

环境要求：Go 1.26+、Node.js 20.19+ / 22.12+、Wails CLI v3、pnpm 12+。

\`\`\`bash
node scripts/init.mjs   # 替换模块名 / 产品信息（若尚未执行）
wails3 dev              # 开发模式（Go 热重载 + Vite HMR）
wails3 build            # 生产构建
wails3 package          # 生成当前系统安装包
\`\`\`

## 常用命令（项目根目录）

| 命令 | 说明 |
| --- | --- |
| \`wails3 task lint\` / \`format\` / \`typecheck\` | ESLint / Prettier / vue-tsc |
| \`wails3 task test\` | 前端 Vitest + Go 测试 |
| \`wails3 task check\` | lint + format + typecheck + vet + test |
| \`wails3 task generate:bindings\` | 重新生成 Go 绑定 |

## 要点

- 桥接层：\`frontend/src/bridge/\`（调用 Go 服务、窗口控制、系统对话框）
- HTTP 请求：\`frontend/src/api/\`（Axios 基座见 \`src/utils/request.ts\`）
- 接入 Go 服务：定义结构体方法 → 注册到 \`main.go\` 的 \`Services\` → \`wails3 task generate:bindings\`
- 提交信息遵循 Conventional Commits（husky + commitlint 强制）
`;

const HELP = `模板清理：删除模板自述文件与本地构建产物

用法: node scripts/clean.mjs [选项]

选项:
  --dry-run          仅预览将删除/改写的文件，不写入
  --keep-readme      保留根目录 README.md（默认改写为极简版）
  --remove-github    额外删除 .github/（release CI 与 dependabot，默认保留）
  --remove-license   额外删除 LICENSE（默认保留）
  --remove-scripts   额外删除 scripts/（需在 init.mjs 之后执行）
  --help             显示帮助`;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    help: false,
    keepReadme: false,
    removeGithub: false,
    removeLicense: false,
    removeScripts: false,
  };
  for (const key of argv) {
    switch (key) {
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--keep-readme':
        args.keepReadme = true;
        break;
      case '--remove-github':
        args.removeGithub = true;
        break;
      case '--remove-license':
        args.removeLicense = true;
        break;
      case '--remove-scripts':
        args.removeScripts = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`无法识别的参数: ${key}`);
    }
  }
  return args;
}

function existsFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function collectRemovals(args) {
  const removals = [];

  for (const [rel, note] of JUNK_DIRS) {
    if (existsSync(join(ROOT, rel))) removals.push({ rel: `${rel}/`, note });
  }
  for (const [rel, note] of JUNK_FILES) {
    if (existsSync(join(ROOT, rel))) removals.push({ rel, note });
  }

  // frontend/dist 只清内容，保留 .gitkeep 占位（Go embed 需要目录始终存在）
  const dist = join(ROOT, 'frontend', 'dist');
  if (existsSync(dist)) {
    for (const name of readdirSync(dist)) {
      if (name === '.gitkeep') continue;
      const isDir = statSync(join(dist, name)).isDirectory();
      removals.push({ rel: `frontend/dist/${name}${isDir ? '/' : ''}`, note: '前端构建产物' });
    }
  }

  for (const name of readdirSync(ROOT)) {
    const hit = ROOT_FILE_PATTERNS.find(([pattern]) => pattern.test(name));
    if (hit && existsFile(join(ROOT, name))) removals.push({ rel: name, note: hit[1] });
  }

  const frontendDir = join(ROOT, 'frontend');
  if (existsSync(frontendDir)) {
    for (const name of readdirSync(frontendDir)) {
      if (FRONTEND_ENV_LOCAL.test(name) && existsFile(join(frontendDir, name))) {
        removals.push({ rel: `frontend/${name}`, note: '本地环境变量覆盖' });
      }
    }
  }

  if (args.removeGithub && existsSync(join(ROOT, '.github'))) {
    removals.push({ rel: '.github/', note: 'GitHub release CI 与 dependabot' });
  }
  if (args.removeLicense && existsSync(join(ROOT, 'LICENSE'))) {
    removals.push({ rel: 'LICENSE', note: '模板占位版权（MIT）' });
  }
  if (args.removeScripts) {
    const goMod = join(ROOT, 'go.mod');
    if (existsSync(goMod) && readFileSync(goMod, 'utf8').includes('module changeme')) {
      throw new Error('go.mod 仍是占位模块名 changeme：请先执行 node scripts/init.mjs，再用 --remove-scripts 删除 scripts/');
    }
    if (existsSync(join(ROOT, 'scripts'))) removals.push({ rel: 'scripts/', note: '模板脚本（clean/init 已用完）' });
  }

  return removals.sort((a, b) => a.rel.localeCompare(b.rel));
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`错误：${error instanceof Error ? error.message : error}`);
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  if (args.help) {
    console.log(HELP);
    return;
  }

  let removals;
  try {
    removals = collectRemovals(args);
  } catch (error) {
    console.error(`错误：${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
    return;
  }

  // README 改写为极简版（已是极简版则跳过，保证幂等）
  const rewrites = [];
  if (!args.keepReadme) {
    const readmePath = join(ROOT, 'README.md');
    const current = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
    if (current.trimEnd() !== README_STUB.trimEnd()) {
      rewrites.push({ rel: 'README.md', note: '改写为极简项目说明' });
    }
  }

  const mode = args.dryRun ? '[dry-run] 将处理' : '已处理';
  console.log(`${mode} ${removals.length + rewrites.length} 项：`);
  for (const { rel, note } of removals) {
    console.log(`  删除 ${rel}  # ${note}`);
  }
  for (const { rel, note } of rewrites) {
    console.log(`  改写 ${rel}  # ${note}`);
  }
  if (removals.length + rewrites.length === 0) {
    console.log('  （无需清理，已是干净状态）');
  }

  if (args.dryRun) {
    console.log('');
    console.log('这是预览模式，未写入任何文件。去掉 --dry-run 即可执行。');
    return;
  }

  for (const { rel } of removals) {
    rmSync(join(ROOT, rel.replace(/\/$/, '')), { recursive: true, force: true });
  }
  for (const rewrite of rewrites) {
    writeFileSync(join(ROOT, rewrite.rel), README_STUB, 'utf8');
  }

  console.log('');
  console.log('接下来建议执行：');
  if (existsSync(join(ROOT, 'scripts', 'init.mjs'))) {
    console.log('  - node scripts/init.mjs   # 替换模块名/产品信息（若尚未执行）');
  }
  console.log('  - git init                # husky 需要 git 仓库');
  console.log('  - wails3 dev              # 开发模式');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
