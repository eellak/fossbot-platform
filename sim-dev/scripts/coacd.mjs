#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const QUALITY_PRESETS = {
  low: {
    threshold: '0.1',
    resolution: '1200',
    mctsIteration: '80',
    mctsDepth: '2',
    mctsNode: '12',
    prepResolution: '35',
  },
  med: {
    threshold: '0.05',
    resolution: '2000',
    mctsIteration: '150',
    mctsDepth: '3',
    mctsNode: '20',
    prepResolution: '50',
  },
  high: {
    threshold: '0.02',
    resolution: '5000',
    mctsIteration: '400',
    mctsDepth: '5',
    mctsNode: '32',
    prepResolution: '80',
  },
};

const SUPPORTED_EXTENSIONS = new Set(['.obj', '.stl']);

function usage() {
  console.error('Usage: npm run coacd -- <input_model_path> [output_model_path] [--quality <low|med|high>] [--dir] [--recursive] [--out-dir <path>] [--skip-existing]');
  console.error('Example: npm run coacd -- ../front-end/public/js-simulator/models/static/eiffel.obj');
  console.error('Example: npm run coacd -- ../front-end/public/js-simulator/models/static/eiffel.obj --quality high');
  console.error('Example: npm run coacd -- ../front-end/public/js-simulator/models/robots/v2 --dir --quality med');
  console.error('Example: npm run coacd -- ../front-end/public/js-simulator/models --dir --recursive --out-dir ../front-end/public/js-simulator/models_coacd');
  console.error('Default: runs `uv run --with coacd --with trimesh coacd`');
  console.error('Quality presets are based on CoACD README tuning guidance: lower threshold + higher search/resolution = better quality but slower runtime.');
  console.error('Environment: set COACD_BINARY to override the command run by uv');
}

function withCoacdSuffix(filePath) {
  const parsed = path.parse(filePath);
  if (!parsed.ext) return `${filePath}_coacd`;
  return path.join(parsed.dir, `${parsed.name}_coacd${parsed.ext}`);
}

function parseArgs(argv) {
  const positionals = [];
  let quality = 'med';
  let dirMode = false;
  let recursive = false;
  let outDirArg;
  let skipExisting = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--quality' || arg === '-q') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --quality. Expected one of: low, med, high');
      }
      quality = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--quality=')) {
      quality = arg.slice('--quality='.length);
      continue;
    }

    if (arg === '--dir') {
      dirMode = true;
      continue;
    }

    if (arg === '--recursive' || arg === '-r') {
      recursive = true;
      continue;
    }

    if (arg === '--skip-existing') {
      skipExisting = true;
      continue;
    }

    if (arg === '--out-dir') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --out-dir');
      }
      outDirArg = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--out-dir=')) {
      outDirArg = arg.slice('--out-dir='.length);
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positionals.push(arg);
  }

  if (!Object.prototype.hasOwnProperty.call(QUALITY_PRESETS, quality)) {
    throw new Error(`Invalid quality: ${quality}. Expected one of: low, med, high`);
  }

  return {
    quality,
    inputArg: positionals[0],
    outputArg: positionals[1],
    dirMode,
    recursive,
    outDirArg,
    skipExisting,
  };
}

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  usage();
  process.exit(1);
}

if (!parsed.inputArg) {
  usage();
  process.exit(1);
}

const quality = parsed.quality;
const qualityPreset = QUALITY_PRESETS[quality];

const coacdBinary = process.env.COACD_BINARY;

function buildUvArgs(inputPath, outputPath) {
  const uvArgs = ['run'];
  if (coacdBinary) {
    uvArgs.push(coacdBinary);
  } else {
    uvArgs.push('--with', 'coacd', '--with', 'trimesh', 'coacd');
  }

  uvArgs.push('-i', inputPath, '-o', outputPath);
  uvArgs.push(
    '-t', qualityPreset.threshold,
    '-r', qualityPreset.resolution,
    '-mi', qualityPreset.mctsIteration,
    '-md', qualityPreset.mctsDepth,
    '-mn', qualityPreset.mctsNode,
    '-pr', qualityPreset.prepResolution,
  );

  return uvArgs;
}

function runCoacd(inputPath, outputPath) {
  const uvArgs = buildUvArgs(inputPath, outputPath);

  console.log('Running CoACD decomposition...');
  console.log(`- input:  ${inputPath}`);
  console.log(`- output: ${outputPath}`);
  console.log(`- quality: ${quality}`);
  console.log(`- params: threshold=${qualityPreset.threshold}, resolution=${qualityPreset.resolution}, mctsIteration=${qualityPreset.mctsIteration}, mctsDepth=${qualityPreset.mctsDepth}, mctsNode=${qualityPreset.mctsNode}, prepResolution=${qualityPreset.prepResolution}`);
  console.log(`- command: uv ${uvArgs.join(' ')}`);

  const result = spawnSync('uv', uvArgs, { stdio: 'inherit' });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      console.error('`uv` was not found. Install uv and ensure a Python environment is available.');
      return { status: 1, missingUv: true };
    }

    console.error(result.error.message);
    return { status: 1, missingUv: false };
  }

  if ((result.status ?? 1) !== 0 && coacdBinary) {
    console.error('Tip: COACD_BINARY is set. If this command is not installed, unset COACD_BINARY to use the default uv-managed CoACD CLI.');
  }

  return { status: result.status ?? 1, missingUv: false };
}

function isSupportedModelFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) return false;

  const parsedPath = path.parse(filePath);
  return !parsedPath.name.endsWith('_coacd');
}

function collectModelFiles(dirPath, recursive) {
  const found = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = readdirSync(currentDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (recursive) stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && isSupportedModelFile(fullPath)) {
        found.push(fullPath);
      }
    }
  }

  return found;
}

function outputPathForDirectoryInput(inputFile, inputRoot, outputRoot) {
  const relativeDir = path.dirname(path.relative(inputRoot, inputFile));
  const parsedInput = path.parse(inputFile);
  const outputName = `${parsedInput.name}_coacd${parsedInput.ext}`;

  if (relativeDir === '.') {
    return path.join(outputRoot, outputName);
  }
  return path.join(outputRoot, relativeDir, outputName);
}

const inputPath = path.resolve(process.cwd(), parsed.inputArg);
if (!existsSync(inputPath)) {
  console.error(`Input path does not exist: ${inputPath}`);
  process.exit(1);
}

const inputStat = statSync(inputPath);

if (parsed.dirMode) {
  if (!inputStat.isDirectory()) {
    console.error(`--dir expects a directory input, got: ${inputPath}`);
    process.exit(1);
  }

  if (parsed.outDirArg && parsed.outputArg) {
    console.error('Use either [output_model_path] or --out-dir in --dir mode, not both.');
    process.exit(1);
  }

  const outDirInput = parsed.outDirArg ?? parsed.outputArg;
  const outputRoot = outDirInput
    ? path.resolve(process.cwd(), outDirInput)
    : inputPath;

  const modelFiles = collectModelFiles(inputPath, parsed.recursive);
  if (modelFiles.length === 0) {
    console.error(`No supported model files found in directory: ${inputPath}`);
    console.error('Supported extensions: .obj, .stl');
    process.exit(1);
  }

  console.log(`Directory mode: ${modelFiles.length} model(s) queued`);
  console.log(`- input dir: ${inputPath}`);
  console.log(`- output dir: ${outputRoot}`);
  console.log(`- recursive: ${parsed.recursive ? 'yes' : 'no'}`);
  console.log(`- skip-existing: ${parsed.skipExisting ? 'yes' : 'no'}`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const inputFile of modelFiles) {
    const outputFile = outputPathForDirectoryInput(inputFile, inputPath, outputRoot);

    if (parsed.skipExisting && existsSync(outputFile)) {
      console.log(`Skipping existing output: ${outputFile}`);
      skipped += 1;
      continue;
    }

    mkdirSync(path.dirname(outputFile), { recursive: true });

    const result = runCoacd(inputFile, outputFile);
    if (result.missingUv) {
      process.exit(1);
    }

    if (result.status !== 0) {
      failed += 1;
    } else {
      processed += 1;
    }
  }

  console.log(`Done. processed=${processed}, skipped=${skipped}, failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

if (parsed.outDirArg) {
  console.error('--out-dir is only valid with --dir mode.');
  process.exit(1);
}

if (inputStat.isDirectory()) {
  console.error(`Input is a directory: ${inputPath}`);
  console.error('Use --dir to process directories.');
  process.exit(1);
}

const outputPath = parsed.outputArg
  ? path.resolve(process.cwd(), parsed.outputArg)
  : withCoacdSuffix(inputPath);

mkdirSync(path.dirname(outputPath), { recursive: true });
const singleResult = runCoacd(inputPath, outputPath);
process.exit(singleResult.status);
