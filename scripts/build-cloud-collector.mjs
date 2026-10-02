import {build} from 'esbuild';
await build({entryPoints:['lib/school-browser/page-entry.ts'],outfile:'generated/classroom-extractor.js',bundle:true,format:'iife',platform:'browser',target:'chrome120',minify:true});
