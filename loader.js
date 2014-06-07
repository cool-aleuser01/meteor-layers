var packages = {};
var layers = {};


Layers = {

  _packages: packages,

  _layers: layers,

  load: function(layer, callback) {
    if (! layers[layer])
      throw new Error('Layer: ' + layer + ' does not exist');

    _.each(layers[layer].packages, function(pkg) {
      Layers.loadPackage(pkg);
    });

    Layers.loadPackage('__layer__' + layer, function() {
      if (typeof callback === 'function')
        callback(Package['__layer__' + layer]);
    });
  },

  loadPackage: function(pkg, callback) {
    // Guard against multiple calls / incorrect calls
    if (! packages[pkg])
      throw new Error('Package: ' + pkg + ' does not exist');

    if (typeof Package[pkg] !== 'undefined' && typeof callback === 'function')
      callback(Package[pkg]);

    if (typeof callback === 'function')
      packages[pkg].callbacks.push(callback);

    if (packages[pkg].loading)
      return;

    packages[pkg].loading = true;

    // Load the javascript
    var lastScript = null;
    _.each(packages[pkg].js, function(jsURI) {
      var done = false;

      // Configure the script tag
      var script = document.createElement('script');
      script.async = false;
      script.setAttribute('type', 'text/javascript');

      script.onload = script.onreadystatechange = function() {
        if (! done && (! this.readyState
                      || this.readyState === 'loaded'
                      || this.readyState === 'complete')) {
          done = true;

          if (lastScript === script) {
            _.each(packages[pkg].callbacks, function(callback) {
              callback(Package[pkg]);
            });
          }

          script.onload = script.onreadystatechange = null;
          document.body.removeChild(script);
        }
      };

      lastScript = script;

      // Perform the request!
      script.setAttribute('src', Meteor.absoluteUrl(jsURI));
      document.body.appendChild(script);
    });

    // Load the css
    _.each(packages[pkg].css, function(cssURI) {
      var link = document.createElement('link');
      document.head.appendChild(link);
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('type', 'text/css');
      link.setAttribute('href', Meteor.absoluteUrl(cssURI));
    });

    // Check if no scripts were loaded and callbacks should fire immediately
    if (lastScript === null) {
      _.each(packages[pkg].callbacks, function(callback) {
        callback(Package[pkg]);
      });
    }
  },

  _registerLayer: function(cfg) {
    cfg.callbacks = [];
    layers[cfg.name] = cfg;
  },

  _registerPackage: function(cfg) {
    cfg.callbacks = [];
    packages[cfg.name] = cfg;
  }
};

