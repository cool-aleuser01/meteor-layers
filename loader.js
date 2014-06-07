var layers = {};

Layers = {
  load: function(layer, callback) {
    if (!layers[layer])
      throw new Error('No such layer exists');

    // Has the layer already been fully loaded?
    if (layers[layer].loaded && typeof callback === 'function')
      callback(Packages['__layer__' + layer]);

    // Record the callback
    if (typeof callback === 'function')
      layers[layer].callbacks.push(callback);


    if (layers[layer].loading)
      return;

    var loaded = 0;

    // Load all of the JS
    _.each(layers[layer].js, function(jsURI) {
      var done = false;

      var script = document.createElement('script');
      script.async = false; // Load order matters
      script.setAttribute('type', 'text/javascript');

      // Listen for the script to finish loading
      script.onload = script.onreadystatechange = function() {
        if (! done && (! this.readyState
                       || this.readyState === 'loaded'
                       || this.readyState === 'complete')) {
          done = true;
          loaded++;

          if (loaded >= layers[layer].js.length) {
            layers[layer].loaded = true;

            _.each(layers[layer].callbacks, function(callback) {
              callback(Packages['__layer__' + layer]);
            });
          }

          // Clean up the script
          script.onload = script.onreadystatechange = null;
          document.body.removeChild(script);
        }
      };

      script.setAttribute('src', Meteor.absoluteUrl(jsURI));
      document.body.appendChild(script);
    });

    // Load all of the CSS
    _.each(layers[layer].css, function(cssURI) {
      var link = document.createElement('link');
      document.head.appendChild(link);
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('type', 'text/css');
      link.setAttribute('href', Meteor.absoluteUrl(cssURI));
    });

    // Check if all JS has already been loaded (there was none)
    if (loaded >= layers[layer].js.length) {
      layers[layer].loaded = true;
      _.each(layers[layer].callbacks, function(callback) {
        callback(Packages['__layer__' + layer]);
      });
    }

    layers[layer].loading = true;
  }, 

  _register: function(options) {
    layers[options.layer] = layers[options.layer] || {};
    layers[options.layer].js = options.js;
    layers[options.layer].css = options.css;
  }
}
