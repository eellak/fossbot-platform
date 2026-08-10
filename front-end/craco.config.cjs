module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.symlinks = false;
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        (warning) => /@mlc-ai\/web-llm\/src\//.test(warning.message || ''),
      ];
      return webpackConfig;
    },
  },
};
