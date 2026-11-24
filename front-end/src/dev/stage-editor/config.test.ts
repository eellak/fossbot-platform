declare const expect: any;
declare const it: any;
const config = require('../../../craco.stage-editor.config.cjs');
const platform = require('../../../craco.config.cjs');

it('uses standalone adapters only in the development configuration', () => {
  const input = () => ({ entry: 'platform-entry', resolve: { alias: {} } });
  expect(platform.webpack.configure(input()).entry).toBe('platform-entry');
  expect(platform.webpack.configure(input()).resolve.alias).toEqual({});
  const editor = config.webpack.configure(input(), { env: 'development' });
  expect(editor.entry).toMatch(/stage-editor\/index.tsx$/);
  expect(editor.resolve.alias['src/authentication/AuthProvider$']).toMatch(/stage-editor\/session.ts$/);
  const withSourceAlias = config.webpack.configure({ resolve: { alias: { src: '/platform/src' } } }, { env: 'development' });
  expect(Object.keys(withSourceAlias.resolve.alias)).toEqual([
    'src/authentication/AuthProvider$', 'src/components/stage-builder/localStages$', 'src',
  ]);
  expect(() => config.webpack.configure(input(), { env: 'production' })).toThrow('development-only');
});

it('serves simulator source assets before the frontend fallback', () => {
  const fallback = { directory: '/frontend/public', publicPath: '/' };
  const server = config.devServer({ static: [fallback] });
  expect(server.static.map((item: any) => item.publicPath)).toEqual(['/simulator/images', '/simulator', '/']);
  expect(server.static[2]).toBe(fallback);
});

export {};
