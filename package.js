Package.describe({
  summary: 'Lazily loaded Layers for Meteor'
});

Package._transitional_registerBuildPlugin({
  name: 'injectLayers',
  use: [],
  sources: ['plugin.js'],
  npmDependencies: {}
});

Package.on_use(function(api) {
  api.add_files(['loader.js'], 'client');
  api.export('Layers', 'client');
});

