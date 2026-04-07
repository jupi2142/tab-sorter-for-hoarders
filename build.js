const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

async function build() {
  const isWatch = process.argv.includes('--watch');

  const ctx = await esbuild.context({
    entryPoints: ['src/background.js'],
    bundle: true,
    outdir: 'dist',
    format: 'iife',
    platform: 'browser',
    target: ['chrome110'],
    minify: false,
    sourcemap: false,
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });

  if (isWatch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete');
  }

  fs.copyFileSync('settings.js', 'dist/settings.js');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
