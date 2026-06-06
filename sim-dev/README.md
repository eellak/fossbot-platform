# sim-dev

This directory is for working on the simulator itself.

## CoACD script usage

Run the CoACD helper from this directory:

```
npm run coacd -- <input_model_path> [output_model_path] [--quality low|med|high]
```

If output_model_path is not provided, the script writes a file with the _coacd suffix.

Example:

```
npm run coacd -- ../front-end/public/js-simulator/models/dynamic/animals/cat.obj --quality high
```

### Directory mode

Process all `.obj` / `.stl` files in a directory:

```
npm run coacd -- <input_dir> --dir [--recursive] [--out-dir <path>] [--skip-existing] [--quality low|med|high]
```

- `--dir`: treat input as directory
- `--recursive`: include subdirectories
- `--out-dir <path>`: write outputs to a separate root (preserves relative structure)
- `--skip-existing`: skip files where `<name>_coacd.<ext>` already exists

Examples:

```
npm run coacd -- ../front-end/public/js-simulator/models/robots/v2 --dir --quality med
npm run coacd -- ../front-end/public/js-simulator/models --dir --recursive --out-dir ../front-end/public/js-simulator/models_coacd --skip-existing
```
