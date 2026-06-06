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