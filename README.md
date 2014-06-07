Layers
======

> Lazily loaded Layers for Meteor

Meteor's bundling mechanisms are fairly simple to understand. Every file in your project is
concatenated, and served to the client upon page load. Once the program has started running,
you don't have to worry about whether or not the package you are depending on has loaded yet.

Unfortunately, for larger web apps, this lack of control can be bad. When the amount of code
exceeds a certain threshold, it is important to split it into multiple different downloads, 
serving only the code necessary for a particular function at a time.

Layers enables this.

Installation
------------

To install Layers, simply run the following:
```bash
mrt add layers
```

Layers will now inject itself into Meteor upon startup. You'll know if Layers is installed
correctly, as your Meteor prompt will print `=> Layers Injected Successfully` if it is.

Usage
-----

Layers reside under the `layers/` directory in your Meteor project. Each folder under `layers/`
is a layer. All files placed into those folders will NOT be loaded on the client when your app
is bundled (they will be loaded on the server), and can instead be loaded asynchronously.

To load the files from a layer, call `Layers.load('layer_name');`. If you need to know when
the layer has finished loading, you can call `Layers.load('layer_name', callback);` to get notified
when the JavaScript has finished loading.

You can also configure your Layer. If your layer depends on a package which your main app does not,
simply declare this in a `layer.json` file, placed in the root of your layer. An example `layer.json`
file looks like this:

```json
{
  "use": [
    "http",
    "iron-router"
  ]
}
```

Packages which are listed here will not be automatically downloaded from atmosphere, they must be downloaded
first, and placed in the `packages/` directory. If you declare a package here which is already included in
your Meteor app, it will not be loaded a second time.

You can also declare exports for your app. These work identically to meteor package exports, and will be
avaliable either as the first parameter to your load callback, or as `Packages['__layer__layer_name']`.
Exports are declared in your `layer.json` file as follows:

```json
{
  "exports": [
    "MyExportedValue"
  ]
}
```

If you only want your code to run on the client, you can place it in a `client` directory, like this: `layers/myLayer/client/*`

How it works
------------

Layers injects itself upon Meteor's startup, capturing all calls to file handlers. It intercepts those which
would cause files which are in the `layers/*` directories to be loaded, and instead uses them to build
custom packages. These packages are then built, and served to the client as assets, which can be loaded
by the `Layers.load()` function.

License
-------

(The MIT License)

Copyright (c) 2013 Michael Layzell

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

