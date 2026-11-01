#!/usr/bin/env node
/**
 * 模板初始化脚本：一键替换模块名与产品信息占位符。
 *
 * 用法：
 *   node scripts/init.mjs                       # 交互式（带默认值提示）
 *   node scripts/init.mjs --dry-run --module github.com/acme/app   # 预览将修改的文件
 *   node scripts/init.mjs --module github.com/acme/app \
 *     --app-id com.acme.app --product-name "My App" --company "Acme"
 *
 * 选项：
 *   --module <path>        Go 模块名（如 github.com/acme/app），必填
 *   --app-id <id>          应用标识 productIdentifier（如 com.acme.app）
 *   --product-name <name>  产品名称（窗口标题 / 页面标题）
 *   --company <name>       公司名称
 *   --project-name <slug>  可执行文件与安装包短名（默认由产品名生成）
 *   --year <year>          版权年份（默认当年）
 *   --dry-run              仅预览，不写入
 *   --help                 显示帮助
 *
 * 脚本会同步：go.mod 模块名、`@bindings/<module>` 导入路径、build/config.yml、
 * main.go、Taskfile.yml、frontend/package.json、frontend/.env、NSIS INFO_PRODUCTID
 * 等位置，并把 frontend/bindings/<旧模块> 目录移动到新模块名下。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 模板默认占位符（与仓库当前内容保持一致） */
const PLACEHOLDER = {
  module: 'changeme',
  appId: 'com.example.wails3vue3template',
  company: 'Example Company',
  productName: 'Wails3 Vue3 Template',
  projectSlug: 'wails3-vue3-template',
  copyrightYear: '2026',
  copyrightHolder: 'ddz12123', // LICENSE 的模板作者版权名，init 时替换为新项目公司名
};

/** 递归收集需要处理的文本文件 */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'bin',
  'coverage',
  'bindings', // 生成代码：内容不含占位符，目录由脚本单独移动
  '.codebuddy',
]);
const SKIP_EXT = new Set([
  '.png', '.ico', '.icns', '.jpg', '.jpeg', '.gif', '.webp', '.pdf',
  '.zip', '.gz', '.ttf', '.woff', '.woff2', '.exe', '.dll', '.syso',
]);

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        collectFiles(join(dir, entry.name), out);
      }
      continue;
    }
    if (!entry.isFile()) continue;
    const dotIdx = entry.name.lastIndexOf('.');
    const ext = dotIdx === -1 ? '' : entry.name.slice(dotIdx).toLowerCase();
    if (SKIP_EXT.has(ext)) continue;
    out.push(join(dir, entry.name));
  }
  return out;
}

function parseArgs(argv) {
  const args = { dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--dry-run') {
      args.dryRun = true;
    } else if (key === '--help' || key === '-h') {
      args.help = true;
    } else if (key.startsWith('--')) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`选项 ${key} 缺少取值`);
      }
      args[key.slice(2)] = value;
      i += 1;
    } else {
      throw new Error(`无法识别的参数: ${key}`);
    }
  }
  return args;
}

const HELP = `模板初始化：替换模块名与产品信息占位符

用法: node scripts/init.mjs [选项]

选项:
  --module <path>        Go 模块名（如 github.com/acme/app），必填
  --app-id <id>          应用标识 productIdentifier（如 com.acme.app）
  --product-name <name>  产品名称
  --company <name>       公司名称
  --project-name <slug>  可执行/安装包短名（默认由产品名生成）
  --year <year>          版权年份（默认 ${String(new Date().getFullYear())}）
  --dry-run              仅预览将修改的文件，不写入
  --help                 显示帮助`;

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'app'
  );
}

/** 从模块名猜测反向域名风格的应用标识，仅作交互默认值 */
function guessAppId(module) {
  const segs = module.split('/').filter(Boolean);
  const host = segs[0] ?? 'com';
  const parts = host.split('.').reverse();
  return [...parts, ...segs.slice(1)].join('.');
}

async function prompt(rl, label, fallback) {
  const hint = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${label}${hint}: `)).trim();
  return answer || fallback;
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

  let {
    module,
    'app-id': appId,
    'product-name': productName,
    company,
    'project-name': projectSlug,
    year,
  } = args;

  // 交互终端只提示缺失项（已通过参数传入的不再询问）；其余场景要求显式传参
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!module) module = await prompt(rl, 'Go 模块名（如 github.com/acme/app）', PLACEHOLDER.module);
      if (!appId) appId = await prompt(rl, '应用标识 productIdentifier', guessAppId(module));
      if (!productName) productName = await prompt(rl, '产品名称', PLACEHOLDER.productName);
      if (!company) company = await prompt(rl, '公司名称', PLACEHOLDER.company);
      if (!projectSlug) projectSlug = await prompt(rl, '可执行/安装包短名', slugify(productName));
      if (!year) year = await prompt(rl, '版权年份', String(new Date().getFullYear()));
    } finally {
      rl.close();
    }
  }

  if (!module) {
    console.error('错误：缺少 Go 模块名。非交互环境请使用 --module <path>（--help 查看全部选项）。');
    process.exitCode = 1;
    return;
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._~/-]*$/.test(module)) {
    console.error(`错误：模块名不合法: ${module}`);
    process.exitCode = 1;
    return;
  }

  appId ??= guessAppId(module);
  productName ??= PLACEHOLDER.productName;
  company ??= PLACEHOLDER.company;
  projectSlug ??= slugify(productName);
  year ??= String(new Date().getFullYear());

  // 顺序敏感：先替换长串，避免被短串截胡
  const edits = [
    // LICENSE：模板作者版权名 → 新项目公司名
    [
      `Copyright © ${PLACEHOLDER.copyrightYear} ${PLACEHOLDER.copyrightHolder}`,
      `Copyright © ${year}, ${company}`,
    ],
    // build/config.yml 的 copyright
    [`© ${PLACEHOLDER.copyrightYear}, ${PLACEHOLDER.company}`, `© ${year}, ${company}`],
    [PLACEHOLDER.appId, appId],
    [PLACEHOLDER.company, company],
    [PLACEHOLDER.productName, productName],
    [PLACEHOLDER.projectSlug, projectSlug],
  ];
  // 模块名只在引用绑定路径 / 模块声明的文件中替换（相对路径统一用 / 分隔）
  const moduleEdit = [PLACEHOLDER.module, module];
  const moduleFiles = new Set([
    'go.mod',
    'main.go', // import "changeme/internal/apperr" 必须随模块名同步，否则改名后编译失败
    'README.md',
    'docs/optional-features.md',
    'frontend/src/bridge/services.ts',
    'frontend/src/bridge/call.ts',
  ]);

  const changedFiles = [];
  for (const file of collectFiles(ROOT)) {
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    // 跳过本脚本自身：占位符常量需要保持模板默认值
    if (rel === 'scripts/init.mjs') continue;
    const isModuleFile = moduleFiles.has(rel);

    let content = readFileSync(file, 'utf8');
    const original = content;

    for (const [from, to] of edits) {
      if (from !== to && content.includes(from)) {
        content = content.split(from).join(to);
      }
    }
    if (isModuleFile && moduleEdit[0] !== moduleEdit[1] && content.includes(moduleEdit[0])) {
      content = content.split(moduleEdit[0]).join(moduleEdit[1]);
    }

    if (content !== original) {
      changedFiles.push(rel);
      if (!args.dryRun) {
        writeFileSync(file, content, 'utf8');
      }
    }
  }

  // 绑定目录随模块名迁移（生成内容不含模块名，移动即可继续使用）
  const oldBindings = join(ROOT, 'frontend', 'bindings', PLACEHOLDER.module);
  const newBindings = join(ROOT, 'frontend', 'bindings', ...module.split('/'));
  if (module !== PLACEHOLDER.module && existsSync(oldBindings)) {
    changedFiles.push(relative(ROOT, oldBindings).replaceAll('\\', '/') + '/');
    if (!args.dryRun) {
      mkdirSync(dirname(newBindings), { recursive: true });
      renameSync(oldBindings, newBindings);
    }
  }

  const mode = args.dryRun ? '[dry-run] 将修改' : '已修改';
  console.log(`${mode} ${changedFiles.length} 个文件/目录：`);
  for (const rel of changedFiles.sort()) {
    console.log(`  ${rel}`);
  }
  console.log('');

  if (args.dryRun) {
    console.log('这是预览模式，未写入任何文件。去掉 --dry-run 即可执行。');
    return;
  }

  console.log('接下来建议执行：');
  console.log('  1. wails3 task common:update:build-assets   # 按 build/config.yml 刷新平台构建资产');
  console.log('  2. wails3 task generate:bindings            # 重新生成 TS 绑定（可选，目录已迁移即可用）');
  console.log('  3. go test ./...                            # 校验产品信息一致性（app_meta_test）');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
