#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

function usage() {
  console.error('Usage: npm run coacd -- <input_model_path> [output_model_path] [--quality <low|med|high>]');
  console.error('Example: npm run coacd -- ../front-end/public/js-simulator/models/static/eiffel.obj');
  console.error('Example: npm run coacd -- ../front-end/public/js-simulator/models/static/eiffel.obj --quality high');
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

const inputPath = path.resolve(process.cwd(), parsed.inputArg);
if (!existsSync(inputPath)) {
  console.error(`Input file does not exist: ${inputPath}`);
  process.exit(1);
}

const outputPath = parsed.outputArg
  ? path.resolve(process.cwd(), parsed.outputArg)
  : withCoacdSuffix(inputPath);

const quality = parsed.quality;
const qualityPreset = QUALITY_PRESETS[quality];

const coacdBinary = process.env.COACD_BINARY;

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

console.log('Running CoACD decomposition...');
console.log(`- input:  ${inputPath}`);
console.log(`- output: ${outputPath}`);
console.log(`- quality: ${quality}`);
console.log(`- params: threshold=${qualityPreset.threshold}, resolution=${qualityPreset.resolution}, mctsIteration=${qualityPreset.mctsIteration}, mctsDepth=${qualityPreset.mctsDepth}, mctsNode=${qualityPreset.mctsNode}, prepResolution=${qualityPreset.prepResolution}`);
console.log(`- command: uv ${uvArgs.join(' ')}`);

const result = spawnSync(
  'uv',
  uvArgs,
  { stdio: 'inherit' },
);

if (result.error) {
  if (result.error.code === 'ENOENT') {
    console.error('`uv` was not found. Install uv and ensure a Python environment is available.');
  } else {
    console.error(result.error.message);
  }
  process.exit(1);
}

if ((result.status ?? 1) !== 0 && coacdBinary) {
  console.error('Tip: COACD_BINARY is set. If this command is not installed, unset COACD_BINARY to use the default uv-managed CoACD CLI.');
}

process.exit(result.status ?? 1);
