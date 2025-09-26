# PostCSS Plugin For Meteor

Meteor CSS Minifier with [PostCSS](https://github.com/postcss/postcss) processing.

This package allows you to use PostCSS plugins with **.css files**. You can add your custom plugins by adding Npm packages using `package.json`. You can also use your favourite preprocessor side by side with this package. It allows you to enable many PostCSS plugins, for example **Autoprefixer** for all preprocessors you use. (Of course you can use it whithout any preprocessor too).

## Usage

1. Remove `standard-minifier-css` package

   ```sh
   meteor remove standard-minifier-css
   ```

2. Add `jessedev:postcss` package

   ```sh
   meteor add jessedev:postcss
   ```

3. Add peer NPM dependencies

   ```sh
   meteor npm install --save-dev postcss@8.3.5 postcss-load-config@3.1.0
   ```

4. Add PostCSS plugins:

   From Meteor 1.3 you can use standard NPM `package.json`. You can add PostCSS plugins in `devDependencies`. You can also install it like `npm install autoprefixer --save-dev`.

   Then you need to prepare PostCSS configuration under the `postcss.plugins`.

   **Important:** Even if you don't want to provide any options you should list your PostCSS plugins in `postcss.plugins` key. This works that way because order here is important. For example 'postcss-easy-import' should be always first PostCSS plugin on the list and 'autoprefixer' should be the last PostCSS plugin on the list. And devDependencies items can be automatically reordered when installing new by `npm install ... --save-dev`.

   See example:

   **package.json (example):**

   ```json
   {
     "name": "demo PostCSS app",
     "version": "1.0.0",
     "description": "",
     "author": "",
     "devDependencies": {
       "autoprefixer": "^6.5.1",
       "mocha": "^3.1.2",
       "postcss": "^6.0.22",
       "postcss-easy-import": "^1.0.1",
       "postcss-load-config": "^1.2.0",
       "postcss-nested": "^1.0.0",
       "postcss-simple-vars": "^3.0.0",
       "rucksack-css": "^0.8.6"
     },
     "postcss": {
       "plugins": {
         "postcss-easy-import": {},
         "postcss-nested": {},
         "postcss-simple-vars": {},
         "rucksack-css": {},
         "autoprefixer": {"browsers": ["last 2 versions"]}
       }
     }
   }
   ```

   Make sure that the plugins that you list in "plugins" are also in "devDependencies" as well. You may not need the plugins in this example, so please include them only if you need them.

   Remember to run `npm install` or `npm update` after changes.

   You can add more plugins here.

   If you want to change something in postcss config later, you should restart your app and also change any .css file to rerun build plugin.

5. Create your standard `.css` files with additional features according to PostCSS plugins you use.

## PostCSS parsers

From version 1.0.0 you can configure parser for PostCSS. To do this you can add `parser` key in the `package.json` file under the `postcss` key. Let's see an example:

```json
{
  "name": "demo PostCSS app",
  "version": "1.0.0",
  "description": "",
  "author": "",
  "devDependencies": {
    "autoprefixer": "^6.5.1",
    "postcss-safe-parser": "^2.0.0"
  },
  "postcss": {
    "plugins": {
      "autoprefixer": {"browsers": ["last 2 versions"]}
    },
    "parser": "postcss-safe-parser"
  }
}
```

As you can see we use here `postcss-safe-parser` which will repair broken css syntax. This is just one example. You can find a list of parsers here: [https://github.com/postcss/postcss#syntaxes](https://github.com/postcss/postcss#syntaxes). You can use `postcss-scss` parser or `postcss-less` parser.

## Exclude Meteor Packages

Because PostCSS processes all CSS files in Meteor, it will also process CSS files from Meteor packages. This is good in most cases and will not break anything, but sometimes it could be problematic.

If you have installed a package which is problematic and PostCSS plugins can't process the CSS files from that package you can exclude it in the process. In this case you need to exclude `constellation:console` package because it uses not standard CSS in its files. PostCSS plugin can't process that file. You can exclude it so it will be not processed by PostCSS, but it will be still bundled as is.

If you want to exclude a package you need to use `postcss.excludedPackages` key, see the example below:

```json
{
  "name": "demo PostCSS app",
  "version": "1.0.0",
  "description": "",
  "author": "",
  "devDependencies": {
    "autoprefixer": "^6.5.1",
    "postcss-safe-parser": "^2.0.0"
  },
  "postcss": {
    "plugins": {
      "autoprefixer": {"browsers": ["last 2 versions"]}
    },
    "parser": "postcss-safe-parser",
    "excludedPackages": ["constellation:console"]
  }
}
```

**Remember that you should provide a package name which contains a problematic CSS file and not global wrapper package** In this example you want to install `babrahams:constellation` but in fact the problematic package is `constellation:console` which is installed with `babrahams:constellation`. You'll find which package makes troubles by looking into the consolle errors. For example here we have something like:

```sh
While minifying app stylesheet:
   packages/constellation_console/client/Constellation.css:118:3: postcss-simple-vars:
   /workspace/meteor/postcss-demo/packages/constellation_console/client/Constellation.css:118:3: Undefined variable $c1

   Css Syntax Error.

   postcss-simple-vars: /workspace/meteor/postcss-demo/packages/constellation_console/client/Constellation.css:118:3: Undefined variable $c1
   background-image: -o-linear-gradient(#000, #000);
   filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='$c1', endColorstr='$c2',GradientType=0);
   ^
   color: rgba(255, 255, 255, 0.6);
```

So we know that this is the problem with `constellation:console` package.

## Imports with PostCSS

You can use imports with [postcss-easy-import](https://github.com/postcss/postcss-easy-import) plugin. **Remember that postcss-easy-import plugin should be loaded first (so put it on the first place in the packages.json file under the 'postcss.plugins' key)**.

You need to use `.import.css` extension and standard import like with preprocessors `@import "my-file.import.css";` Files with `.import.css` will be ommited by css minifier from this package. You can also put them in an `imports` folder (from Meteor 1.3). Also read more about `postcss-easy-import` and `postcss-import` which is a part of the first one.

Imports from Meteor packages will not work. But there is a good news too. from Meteor 1.3 you can use standard Npm packages and imports from `node_modules` should work. So you will be able to import css files from instaled Npm packages. You will be able to do something like: `@import 'my-npm-lib/styles.css'`;

## Usage with preprocessors like Stylus and Sass

You can use it side by side with your favourite preprocessor. There is an example in the demo app.

You should be able to use PostCSS plugins syntax in the .styl or .scss files too. (Tested only with Stylus).

## Alternative configuration locations

This package uses [postcss-load-config](https://github.com/michael-ciniawsky/postcss-load-config) to load
configuration for PostCSS. This allows you to put PostCSS configuration into alternative locations and not
just `package.json`. An interesting option is to put configuration into `.postcssrc.js` file in the root
directory of your app, which allows you to dynamically decide on the configuration. Example:

```js
module.exports = (ctx) => {
  // This flag is set when loading configuration by this package.
  if (ctx.meteor) {
    const config = {
      plugins: {
        'postcss-easy-import': {},
      },
    };

    if (ctx.env === 'production') {
      // "autoprefixer" is reported to be slow,
      // so we use it only in production.
      config.plugins.autoprefixer = {
        browsers: [
          'last 2 versions',
        ],
      };
    }

    return config;
  }
  else {
    return {};
  }
};
```

## License

MIT
