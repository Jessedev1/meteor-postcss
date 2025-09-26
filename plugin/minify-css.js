const { checkNpmVersions } = require('meteor/tmeasday:check-npm-versions');
const postcss = require('postcss');
const loadPostcssConfig = require('postcss-load-config');

checkNpmVersions(
	{ postcss: '8.4.x', 'postcss-load-config': '3.1.x' },
	'jessedev:postcss'
);

// Not used, but available.
var fs = Plugin.fs;
var path = Plugin.path;

Plugin.registerMinifier({ extensions: ['css'] }, function () {
	return new CssToolsMinifier();
});

let loaded = false;
let postcssConfigPlugins = [];
let postcssConfigParser = null;
let postcssConfigExcludedPackages = [];

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
	}
}

function isNotInExcludedPackages(excludedPackages, pathInBundle) {
	if (!Array.isArray(excludedPackages)) return true;
	return !excludedPackages.some((packageName) => {
		const processed = packageName?.replace(':', '_');
		return pathInBundle && pathInBundle.includes('packages/' + processed);
	});
}

function isNotImport(inputFileUrl) {
	return !/\.import\.css$/.test(inputFileUrl) && !/(?:^|\/)imports\//.test(inputFileUrl);
}

function CssToolsMinifier() { }

CssToolsMinifier.prototype.processFilesForBundle = async function (files, options) {
	await loadPostcssConfigOnce();

	const mode = options.minifyMode;
	if (!files.length) return;

	const filesToMerge = files.filter((file) => isNotImport(file._source.url));
	const merged = await mergeCss(filesToMerge);

	if (mode === 'development') {
		files[0].addStylesheet({
			data: merged.code,
			path: 'merged-stylesheets.css',
		});
		return;
	}

	const minifiedFiles = CssTools.minifyCss(merged.code);
	minifiedFiles.forEach((minified) => {
		files[0].addStylesheet({ data: minified });
	});
};

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

				result.warnings().forEach((warn) => {
					process.stderr.write(String(warn));
				});

				const ast = CssTools.parseCss(result.css, { source: filename, position: true });
				ast.filename = filename;
				return ast;
			} catch (e) {
				file.error({ message: e.message, line: e.line, column: e.column });
				return { type: 'stylesheet', stylesheet: { rules: [] }, filename };
			}
		})
	);

	const mergedCssAst = CssTools.mergeCssAsts(cssAsts, (filename, msg) => {
		console.log(filename + ': warn: ' + msg);
	});

	return {
		code: CssTools.stringifyCss(mergedCssAst).code,
	};
}
