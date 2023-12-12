import { useRef, useEffect } from 'react';
import jQuery from 'jquery';
import terminal from 'jquery.terminal';
import 'jquery.terminal/css/jquery.terminal.min.css';

import './pythonTerminal.css';

// interface PythonTerminalProps {
//   pyodide: any;
//   interpreter: (command: string) => Promise<void>;
// }

type PythonTerminalProps = {
    terminalOutput: string;
};

const PythonTerminal = ({ terminalOutput }: PythonTerminalProps) => {
  let indexURL: string = 'https://cdn.jsdelivr.net/pyodide/v0.21.2/full/';
  let term: JQueryTerminal;
  let termReady: any;
  let echo: any;
  let pyodide: any;

  const ps1 = '>>> ';
  const ps2 = '... ';

  let repr_shorten: any;
  let banner: any;
  let await_fut: any;
  let pyconsole: any;
  let clear_console: any;
  const terminalRef = useRef<any>();

  useEffect(() => {
    (async function () {
      const urlParams = new URLSearchParams(window.location.search);
      const buildParam = urlParams.get('build');
      if (buildParam) {
        if (['full', 'debug', 'pyc'].includes(buildParam)) {
          indexURL = indexURL.replace('/full/', '/' + urlParams.get('build') + '/');
        } else {
          console.warn('Invalid URL parameter: build="' + buildParam + '". Using default "full".');
        }
      }
      const { loadPyodide } = await import(indexURL + 'pyodide.mjs');

      pyodide = await loadPyodide({
        indexURL,
        stdin: () => {
          let result = prompt();
          echo(result);
          return result;
        },
      });

      const namespace = pyodide.globals.get('dict')();

      pyodide.runPython(
        `
                    import sys
                    from pyodide.ffi import to_js
                    from pyodide.console import PyodideConsole, repr_shorten, BANNER
                    import __main__
                    BANNER = "Welcome to the FOSSBot terminal 🐍\\n" + BANNER
                    pyconsole = PyodideConsole(__main__.__dict__)
                    import builtins
                    async def await_fut(fut):
                      res = await fut
                      if res is not None:
                        builtins._ = res
                      return to_js([res], depth=1)
                    def clear_console():
                      pyconsole.buffer = []
                `,
        { globals: namespace },
      );

      repr_shorten = namespace.get('repr_shorten');
      banner = namespace.get('BANNER');
      await_fut = namespace.get('await_fut');
      pyconsole = namespace.get('pyconsole');
      clear_console = namespace.get('clear_console');
      console.log('okk');

      echo = (msg: any, ...opts: any) =>
        term.echo(msg.replaceAll(']]', '&rsqb;&rsqb;').replaceAll('[[', '&lsqb;&lsqb;'), ...opts);

      namespace.destroy();

      jQuery.noConflict(); // you don't need to use this
      terminal(window, jQuery); // jQuery Terminal exports the main function that needs to be called with an instance of jQuery

      jQuery(($) => {
        term = $(terminalRef.current).terminal(interpreter, {
          greetings: banner,
          prompt: ps1,
          completionEscape: false,
          completion: function (command: any, callback: any) {
            callback(pyconsole.complete(command).toJs()[0]);
          },
          keymap: {
            'CTRL+C': async function (event: any, original: any) {
              clear_console();
              term.enter();
              echo('KeyboardInterrupt');
              term.set_command('');
              term.set_prompt(ps1);
            },
            TAB: (event: any, original: any) => {
              const command = term.before_cursor();
              // Disable completion for whitespaces.
              if (command.trim() === '') {
                term.insert('\t');
                return false;
              }
              return original(event);
            },
          },
        });
      });

      (window as any).term = term;
      pyconsole.stdout_callback = (s: any) => echo(s, { newline: false });
      pyconsole.stderr_callback = (s: any) => {
        term.error(s.trimEnd());
      };
      termReady = Promise.resolve();
      pyodide._api.on_fatal = async (e: any) => {
        if (e.name === 'Exit') {
          jQuery(() => {
            term.error(e);
            term.error('Pyodide exited and can no longer be used.');
          });
        } else {
          jQuery(() => {
            term.error(
              'Pyodide has suffered a fatal error. Please report this to the Pyodide maintainers.',
            );
            term.error('The cause of the fatal error was:');
            term.error(e);
            term.error('Look in the browser console for more details.');
          });
        }
        await termReady;
        jQuery(() => {
          term.pause();
        });
        await sleep(15);
        jQuery(() => {
          term.pause();
        });
      };
    })();
  }, []); // evaluate python code with pyodide and set output ,

  async function lock() {
    console.log('lock');
    let resolve;
    const ready = termReady;
    termReady = new Promise((res) => (resolve = res));
    await ready;
    console.log('lock ready');
    return resolve;
  }

  function sleep(s: any) {
    return new Promise((resolve) => setTimeout(resolve, s));
  }

  async function interpreter(command: any) {
    console.log('interpreter start with command:', command);
    const unlock: any = await lock();

    jQuery(() => {
      term.pause();
    });
    console.log('term.pause()');

    // multiline should be split (useful when pasting)
    for (const c of command.split('\n')) {
      const escaped = c.replaceAll(/\u00a0/g, ' ');
      const fut = pyconsole.push(escaped);
      term.set_prompt(fut.syntax_check === 'incomplete' ? ps2 : ps1);
      switch (fut.syntax_check) {
        case 'syntax-error':
          term.error(fut.formatted_error.trimEnd());
          continue;
        case 'incomplete':
          continue;
        case 'complete':
          break;
        default:
          throw new Error(`Unexpected type`);
      }

      // In JavaScript, await automatically also awaits any results of
      // awaits, so if an async function returns a future, it will await
      // the inner future too. This is not what we want so we
      // temporarily put it into a list to protect it.
      const wrapped = await_fut(fut);
      // complete case, get result / error and print it.
      try {
        const [value] = await wrapped;
        if (value !== undefined) {
          echo(
            repr_shorten.callKwargs(value, {
              separator: '\n<long output truncated>\n',
            }),
          );
        }
        if (pyodide.isPyProxy(value)) {
          value.destroy();
        }
      } catch (e: any) {
        if (e.constructor.name === 'PythonError') {
          const message = fut.formatted_error || e.message;
          term.error(message.trimEnd());
        } else {
          throw e;
        }
      } finally {
        fut.destroy();
        wrapped.destroy();
      }
    }
    term.resume();
    console.log('term.resume()');
    await sleep(10);
    console.log('sleep(10)');
    unlock();
    console.log('interpreter end');
  }

  return <div ref={terminalRef} className="python-terminal"></div>;
};

export default PythonTerminal;
