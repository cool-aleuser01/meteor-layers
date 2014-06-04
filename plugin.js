var fs = Npm.require('fs');
var path = Npm.require('path');
var _ = Npm.require('underscore');
var crypto = Npm.require('crypto');

var packages = Npm.require('./packages.js');
var buildmessage = Npm.require('./buildmessage.js');
var log = Npm.require('./run-log.js');
var release = Npm.require('./release.js');
var linker = Npm.require('./linker.js');
var unipackage = Npm.require('./unipackage.js');
var project = Npm.require('./project.js');

var minifiers = unipackage.load({
  library: release.current.library,
  packages: ['minifiers']
}).minifiers;


/***
 *       __  ______________    _________________________
 *      / / / /_  __/  _/ /   /  _/_  __/  _/ ____/ ___/
 *     / / / / / /  / // /    / /  / /  / // __/  \__ \ 
 *    / /_/ / / / _/ // /____/ /  / / _/ // /___ ___/ / 
 *    \____/ /_/ /___/_____/___/ /_/ /___/_____//____/  
 *                                                      
 */

// The root directory of the Meteor project
var meteorRoot = (function() {
  function isAppDir(filepath) {
    try {
      return fs.statSync(path.join(filepath, '.meteor', 'packages')).isFile();
    } catch (e) {
      return false;
    }
  }

  var currentDir = process.cwd();
  while (currentDir) {
    var newDir = path.dirname(currentDir);

    if (isAppDir(currentDir)) {
      break;
    } else if (newDir === currentDir) {
      return null;
    } else {
      currentDir = newDir;
    }
  }

  return currentDir;
})();

// Generates a cache buster string
function cacheBuster(src) {
  var shasum = crypto.createHash('sha1');
  shasum.update(src);
  return shasum.digest('hex');
}

// Adds a cache buster to the given URI
function addCacheBuster(uri, src) {
  return uri + '?' + cacheBuster(src);
}

// Generates a source map URL (with cache busting capabilities)
function sourceMappingUrl(uri, sourceMap) {
  return path.join(path.dirname(uri), cacheBuster(sourceMap) + '.map');
}

// Inspects the command line arguments to determine if it should minfiy
function shouldMinify() {
  if (process.argv.length < 3)
    return false;

  if (process.argv[2].charAt(0) === '-' || process.argv[2] === 'run') {
    // When running the app, minify only if --production is set
    return process.argv.indexOf('--production') !== -1;
  }

  if (process.argv[2] === 'deploy' || process.argv[2] === 'bundle') {
    // When bundling/deploying the app, minify unless --debug is set
    return process.argv.indexOf('--debug') === -1;
  }

  // Minify if some other command is called... I guess?
  return true;
}


/***
 *       __________  __  _______  ______    ___  ______________  _   __
 *      / ____/ __ \/  |/  / __ \/  _/ /   /   |/_  __/  _/ __ \/ | / /
 *     / /   / / / / /|_/ / /_/ // // /   / /| | / /  / // / / /  |/ / 
 *    / /___/ /_/ / /  / / ____// // /___/ ___ |/ / _/ // /_/ / /|  /  
 *    \____/\____/_/  /_/_/   /___/_____/_/  |_/_/ /___/\____/_/ |_/   
 *                                                                     
 */

var layers = {};
function addFileToLayer(layer, file) {
  layers[layer] = layers[layer] || [];
  layers[layer].push(file);
}

var savedCompileStep = null;

// Matches the layer in a path. match[1] will be the name of the layer
var layerRe = /^layers\/([^\/]+)\//;

/**
 * Called for every compileStep - use it to capture the compilation of the root app
 */
function compileStepInject(compileStep, handler) {
  // Only inject compileStep when it is in the current app, and
  // in the browser.
  if (compileStep.packageName !== null ||
      ! compileStep.archMatches('browser'))
    return false; // Run the handler normally

  // Check if the file is inside of a layer
  var match = compileStep.inputPath.match(layerRe);
  if (! match)
    return false;

  // Record the file, and save the compileStep
  addFileToLayer(match[1], compileStep.inputPath);
  savedCompileStep = compileStep;
  return true;
}

/**
 * Called when all compileSteps have been called, and savedCompileStep is set.
 * Only called for the root application, not for packages.
 *
 * Used to build layers, and inject them into the app before prelinking.
 */
function buildLayers() {
  _.each(layers, function(files, name) {
    // Each layer is internally a package, lets make one
    var pkg = new packages.Package(release.current.library, 'layers/' + name);

    // We need to make a client package, but we can modify an os one into one
    pkg.initFromOptions('__layer__' + name, {
      sourceRoot: meteorRoot,
      serveRoot: '/',
      sliceName: 'main',
      use: project.getPackages(meteorRoot),
      sources: files
    });

    // Hack the package into a Browser package (initFromOptions creates an os package)
    pkg.defaultSlices['browser'] = pkg.defaultSlices['os'];
    delete pkg.defaultSlices['os'];

    var slice = pkg.slices[0];
    slice.arch = 'browser';
    slice.id = pkg.id + '.layer@browser';

    // Build the package!
    pkg.build();

    addAssets(name, [pkg], savedCompileStep);
    savedCompileStep = null;
  });
}

/**
 * Add the assets provided by the given packages to the compileStep,
 * under the given layer name.
 */
function addAssets(layer, pkgs, compileStep) {
  var minify = shouldMinify();

  var options = {
    layer: layer
  };

  _.each(pkgs, function(pkg) {
    var assets = pkg.getSingleSlice('main', 'browser').getResources('browser');

    _.each(assets, function(asset) {
      var uri = asset.servePath.substring(1);
      var data = asset.data;

      /*** SOURCE MAPS ***/
      if (asset.sourceMap && ! minify) {
        var src = data.toString('utf8');
        var smu = sourceMappingUrl(uri, asset.sourceMap);

        if (asset.type === 'js')
          src += '\n\n//# sourceMappingURL=' + path.basename(smu) + '\n';
        else if (asset.type === 'css')
          src += '\n\n/*# sourceMappingURL=' + path.basename(smu) + ' */\n';

        compileStep.addAsset({
          data: new Buffer(asset.sourceMap, 'utf8'),
          path: smu
        });

        data = new Buffer(src, 'utf8');
      }

      /*** MINIFICATION ***/
      if (minify) {
        var src = data.toString('utf8');

        if (asset.type === 'js') {
          src = minifiers.UglifyJSMinify(src, {
            fromString: true,
            compress: { drop_debugger: false }
          }).code;
        } else if (asset.type === 'css') {
          src = minifers.CssTools.minifyCss(src);
        }

        data = new Buffer(src, 'utf8');
      }

      /*** RECORD FILE SERVE PATH ***/
      options[asset.type] = options[asset.type] || [];
      options[asset.type].push(addCacheBuster(uri, data.toString('utf8')));

      compileStep.addAsset({
        data: data,
        path: uri
      });
    });
  });

  /*** SERVE REGISTRATION ***/
  compileStep.addJavaScript({
    data: 'Package["layers"].Layers._register(' + JSON.stringify(options) + ');',
    sourcePath: 'layers/' + layer,
    path: 'layers/register/' + layer + '.js'
  });
}


/***
 *        _____   __    ______________________
 *       /  _/ | / /   / / ____/ ____/_  __/ /
 *       / //  |/ /_  / / __/ / /     / / / / 
 *     _/ // /|  / /_/ / /___/ /___  / / /_/  
 *    /___/_/ |_/\____/_____/\____/ /_/ (_)   
 *                                            
 */
var pkgProto = packages.Package.prototype;
if (! pkgProto.__layersInjected) {
  log.logTemporary('=> Injecting Layers...');

  // The markBoundary function is used to call handler functions. By wrapping it,
  // we can intercept handler functions! Awesome! (we do need to check that it is
  // a handler function though).
  var oldMarkBoundary = buildmessage.markBoundary;
  buildmessage.markBoundary = function() {
    var wrapped = oldMarkBoundary.apply(this, arguments);
    return function(compileStep) {
      // Check if this is actually a compileStep
      if (arguments.length === 1 &&
          typeof compileStep === 'object' &&
          compileStep.inputPath) {
        if (compileStepInject.call(this, compileStep, wrapped)) {
          // We chose to block its execution!
          return;
        }
      }

      return wrapped.apply(this, arguments);
    };
  };

  // The prelink function is called after all handler functions have been called 
  // for a package. We use this to mark the end of the compilation of the app
  // package. 
  var oldPrelink = linker.prelink;
  linker.prelink = function(options) {
    if (options.name === null && savedCompileStep)
      buildLayers();

    return oldPrelink.apply(this, arguments);
  };

  // Insure that injection doesn't happen twice
  pkgProto.__layersInjected = true;

  log.log('=> Layers Injected Successfully. '
          + (shouldMinify() ? '(minifying)' : ''));
}

