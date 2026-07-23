let runtime: any;

async function getRuntime() {
  if (!runtime) {
    const pyodide = await import('pyodide');
    runtime = await pyodide.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
  }
  return runtime;
}

self.onmessage = async (event: MessageEvent<{ source: string }>) => {
  try {
    const pyodide = await getRuntime();
    pyodide.globals.set('course_starter_source', event.data.source);
    pyodide.runPython("compile(course_starter_source, '<lesson starter>', 'exec')");
    self.postMessage({ valid: true });
  } catch (error) {
    self.postMessage({ valid: false, message: error instanceof Error ? error.message : String(error) });
  }
};
