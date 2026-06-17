module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.symlinks = false;
      return webpackConfig;
    },
  },
};
