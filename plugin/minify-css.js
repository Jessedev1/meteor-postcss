// packages/minifier-postcss/plugin/minify-css.js

// Comments are in English as requested

const { checkNpmVersions } = require('meteor/tmeasday:check-npm-versions');
const postcss = require('postcss');
const loadPostcssConfig = require('postcss-load-config');

checkNpmVersions(
  { postcss: '8.4.x', 'postcss-load-config': '3.1.x' },
  'jessedev:postcss'
);

// Exposed by Meteor build plugin runtime
var fs = Plugin.fs;
var path = Plugin.path;

Plugin.registerMinifier({ extensions: ['css'] }, function () {
  return new CssToolsMinifier();
});

// Cache for postcss config
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
    postcssConfigParser = config.options?.parser || null;
    postcssConfigExcludedPackages = config.options?.excludedPackages || [];
  } catch (error) {
    // If no config is found that is fine
    if (!error?.message?.includes('No PostCSS Config found')) {
      throw error;
    }
  }
}

/**
 * Helpers to normalize values before passing to addStylesheet
 */
function isPromise(v) {
  return v && typeof v.then === 'function';
}

async function toStringResolved(v) {
  const val = isPromise(v) ? await v : v;
  if (val == null) return '';
  // Accept common shapes: string, { code }, { css }
  const maybe =
    typeof val === 'string'
      ? val
      : typeof val === 'object'
      ? val.code ?? val.css ?? ''
      : String(val);
  return String(maybe);
}

/**
 * Exclusion helpers
 */
function isNotInExcludedPackages(excludedPackages, pathInBundle) {
  if (!Array.isArray(excludedPackages)) return true;
  return !excludedPackages.some((packageName) => {
    const processed = packageName ? packageName.replace(':', '_') : '';
    return pathInBundle && pathInBundle.includes('packages/' + processed);
  });
}

function isNotImport(inputFileUrl) {
  return (
    !/\.import\.css$/.test(inputFileUrl) &&
    !/(?:^|\/)imports\//.test(inputFileUrl)
  );
}

/**
 * Minifier class
 */
function CssToolsMinifier() {}

/**
 * Meteor 3 allows async processFilesForBundle
 */
CssToolsMinifier.prototype.processFilesForBundle = async function (files, options) {
  await loadPostcssConfigOnce();

  const mode = options.minifyMode;
  if (!files?.length) return;

  // Only merge top level stylesheets
  const filesToMerge = files.filter((file) => isNotImport(file._source.url));
  const merged = await mergeCss(filesToMerge);

  // Ensure plain string for dev addStylesheet
  const mergedCode = await toStringResolved(merged.code);

  if (mode === 'development') {
    files[0].addStylesheet({
      data: mergedCode,
      path: 'merged-stylesheets.css',
    });
    return;
  }

  // Minify may return string, array, object, or a promise for any of those
  let minified = await (async () => {
    const res = CssTools.minifyCss(mergedCode);
    return isPromise(res) ? await res : res;
  })();

  if (Array.isArray(minified)) {
    const parts = await Promise.all(minified.map(toStringResolved));
    parts.forEach((css) => files[0].addStylesheet({ data: css }));
  } else if (minified && typeof minified === 'object') {
    const code = await toStringResolved(minified);
    files[0].addStylesheet({ data: code });
  } else {
    // string or other scalar
    const code = await toStringResolved(minified);
    files[0].addStylesheet({ data: code });
  }
};

/**
 * PostCSS and merge with CssTools, no sourcemaps
 */
async function mergeCss(cssFiles) {
  const cssAsts = await Promise.all(
    cssFiles.map(async (file) => {
      const filename = file.getPathInBundle();
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

        // Forward warnings to stderr but do not fail the build
        result.warnings().forEach((warn) => {
          process.stderr.write(String(warn) + '\n');
        });

        const ast = CssTools.parseCss(result.css, {
          source: filename,
          position: true,
        });
        ast.filename = filename;
        return ast;
      } catch (e) {
        // Emit a nice error on the specific file and continue with empty sheet
        const message =
          e?.name === 'CssSyntaxError' && typeof e.showSourceCode === 'function'
            ? e.message + '\n\nCss Syntax Error\n\n' + e.showSourceCode()
            : e?.reason || e?.message || String(e);

        file.error({
          message,
          line: e?.line,
          column: e?.column,
        });

        return {
          type: 'stylesheet',
          stylesheet: { rules: [] },
          filename,
        };
      }
    })
  );

  const mergedCssAst = CssTools.mergeCssAsts(cssAsts, (filename, msg) => {
    // Non fatal warning
    console.log(filename + ': warn: ' + msg);
  });

  // CssTools.stringifyCss historically returns an object with .code
  // but we normalize to string defensively
  const stringified = CssTools.stringifyCss(mergedCssAst);
  const code =
    typeof stringified === 'string'
      ? stringified
      : String(stringified?.code || '');

  return { code };
}
