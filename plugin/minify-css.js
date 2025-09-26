const sourcemap = require('source-map');
const postcss = require('postcss');
const loadPostcssConfig = require('postcss-load-config');

const { checkNpmVersions } = require('meteor/tmeasday:check-npm-versions');

checkNpmVersions(
  { postcss: '8.3.x', 'postcss-load-config': '3.1.x' },
  'jessedev:postcss'
);

// Not used, but available.
var fs = Plugin.fs;
var path = Plugin.path;

Plugin.registerMinifier({ extensions: ['css'] }, function () {
  const minifier = new CssToolsMinifier();
  return minifier;
});

let loaded = false;
let postcssConfigPlugins = [];
let postcssConfigParser = null;
let postcssConfigExcludedPackages = [];

/**
 * Load PostCSS config once
 */
async function loadPostcssConfigOnce() {
  if (loaded) return;
  loaded = true;

  try {
    const config = await loadPostcssConfig({ meteor: true });
    postcssConfigPlugins = config.plugins || [];
    postcssConfigParser = config.options.parser || null;
    postcssConfigExcludedPackages = config.options.excludedPackages || [];
  } catch (error) {
    if (!error?.message?.includes('No PostCSS Config found')) {
      throw error;
    }
    // geen config is oké
  }
}

function isNotInExcludedPackages(excludedPackages, pathInBundle) {
  if (!Array.isArray(excludedPackages)) return true;
  return !excludedPackages.some((packageName) => {
    const processed = packageName?.replace(':', '_');
    return pathInBundle && pathInBundle.indexOf('packages/' + processed) > -1;
  });
}

function isNotImport(inputFileUrl) {
  return !/\.import\.css$/.test(inputFileUrl) && !/(?:^|\/)imports\//.test(inputFileUrl);
}

function CssToolsMinifier() {}

/**
 * In Meteor 3 mag deze async zijn
 */
CssToolsMinifier.prototype.processFilesForBundle = async function (files, options) {
  await loadPostcssConfigOnce();

  const mode = options.minifyMode;
  if (!files.length) return;

  const filesToMerge = files.filter((file) => isNotImport(file._source.url));
  const merged = await mergeCss(filesToMerge);

  if (mode === 'development') {
    files[0].addStylesheet({
      data: merged.code,
      sourceMap: merged.sourceMap,
      path: 'merged-stylesheets.css',
    });
    return;
  }

  const minifiedFiles = CssTools.minifyCss(merged.code);
  if (files.length) {
    minifiedFiles.forEach((minified) => {
      files[0].addStylesheet({ data: minified });
    });
  }
};

/**
 * Lint, PostCSS en merge van CSS, met sourcemaps
 */
async function mergeCss(cssFiles) {
  const originals = {};

  const cssAsts = await Promise.all(
    cssFiles.map(async (file) => {
      const filename = file.getPathInBundle();
      originals[filename] = file;

      const shouldRunPostcss = isNotInExcludedPackages(
        postcssConfigExcludedPackages,
        file.getPathInBundle()
      );

      try {
        const result = await postcss(shouldRunPostcss ? postcssConfigPlugins : [])
          .process(file.getContentsAsString(), {
            from: process.cwd() + (file._source.url?.replace('/__cordova', '') || ''),
            parser: postcssConfigParser || undefined,
          });

        result.warnings().forEach((warn) => {
          process.stderr.write(String(warn));
        });

        const parseOptions = { source: filename, position: true };
        const ast = CssTools.parseCss(result.css, parseOptions);
        ast.filename = filename;
        return ast;
      } catch (e) {
        // Mooie foutmeldingen richting Meteor
        if (e.name === 'CssSyntaxError') {
          file.error({ message: e.message + '\n\nCss Syntax Error.\n\n' + e.showSourceCode?.(), line: e.line, column: e.column });
        } else if (e.reason) {
          file.error({ message: e.reason, line: e.line, column: e.column });
        } else {
          file.error({ message: e.message });
        }

        return {
          type: 'stylesheet',
          stylesheet: { rules: [] },
          filename,
        };
      }
    })
  );

  const warnCb = function (filename, msg) {
    // Niet fataal, enkel een waarschuwing
    console.log(filename + ': warn: ' + msg);
  };

  const mergedCssAst = CssTools.mergeCssAsts(cssAsts, warnCb);

  const stringifiedCss = CssTools.stringifyCss(mergedCssAst, {
    sourcemap: true,
    inputSourcemaps: false,
  });

  if (!stringifiedCss.code) {
    return { code: '' };
  }

  // Sources content toevoegen
  stringifiedCss.map.sourcesContent = stringifiedCss.map.sources.map((name) => {
    return originals[name].getContentsAsString();
  });

  // Bestaande maps van inputs toepassen
  const newMap = sourcemap.SourceMapGenerator.fromSourceMap(
    new sourcemap.SourceMapConsumer(stringifiedCss.map)
  );

  Object.keys(originals).forEach((name) => {
    const file = originals[name];
    const srcMap = file.getSourceMap();
    if (!srcMap) return;
    try {
      newMap.applySourceMap(new sourcemap.SourceMapConsumer(srcMap), name);
    } catch {
      // Als een map niet toepasbaar is, negeren
    }
  });

  return {
    code: stringifiedCss.code,
    sourceMap: newMap.toString(),
  };
}
