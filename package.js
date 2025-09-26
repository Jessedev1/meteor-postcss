Package.describe({
  summary: 'Minifier for Meteor with PostCSS processing - use Autoprefixer and others with ease',
  version: '3.0.0',
  name: 'jessedev:postcss',
  git: 'https://github.com/Jessedev1/meteor-postcss.git'
});

Package.registerBuildPlugin({
  name: 'minifier-postcss',
  use: [
    'ecmascript@0.15.2',
    'minifier-css@2.0.1',
    'tmeasday:check-npm-versions@1.0.2'
  ],
  npmDependencies: {
    'source-map': '0.5.6',
    'app-module-path': '2.2.0'
  },
  sources: [
    'plugin/minify-css.js'
  ]
});

Package.onUse(function (api) {
  api.use('isobuild:minifier-plugin@1.0.0');
});

Package.onTest(function (api) {

});
