// Renders one MP4 per category in data/awards.json into out/.
// Usage: node render-all.mjs            (all categories)
//        node render-all.mjs best-newcomer
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const {categories} = JSON.parse(readFileSync('data/awards.json', 'utf8'));
const only = process.argv.slice(2);
// Optional: point at a specific Chrome build, otherwise Remotion downloads its own.
const browser = process.env.REMOTION_BROWSER;

for (const c of categories) {
	if (only.length && !only.includes(c.id)) continue;
	console.log(`\n▶ ${c.title}`);
	const args = ['remotion', 'render', 'src/index.ts', c.id, `out/${c.id}.mp4`];
	if (browser) args.push(`--browser-executable=${browser}`);
	const r = spawnSync('npx', args, {stdio: 'inherit'});
	if (r.status !== 0) process.exit(r.status ?? 1);
}
