// Awards Video app: local server for the browser UI.
// Start with `npm start` (or the Start Awards launcher). Everything stays on this computer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const CLIPS = path.join(PUBLIC, 'clips');
const OUT = path.join(ROOT, 'out');
const DATA = path.join(ROOT, 'data', 'awards.json');
const UI_BUILD = path.join(ROOT, 'app', '.build');
const PORT = Number(process.env.PORT || 4321);
const BROWSER = process.env.REMOTION_BROWSER || null;

for (const d of [CLIPS, OUT, UI_BUILD]) fs.mkdirSync(d, {recursive: true});

// ---------- build the UI ----------
console.log('Preparing the app…');
await esbuild.build({
	entryPoints: [path.join(ROOT, 'app', 'ui', 'main.tsx')],
	bundle: true,
	outdir: UI_BUILD,
	format: 'esm',
	jsx: 'automatic',
	loader: {'.woff2': 'file', '.woff': 'file'},
	define: {'process.env.NODE_ENV': '"production"'},
	minify: true,
	logLevel: 'error',
});

// ---------- rendering ----------
let serveUrl = null;
const getServeUrl = async () => {
	if (serveUrl) return serveUrl;
	const {bundle} = await import('@remotion/bundler');
	job.message = 'Preparing renderer (first time only)…';
	serveUrl = await bundle({entryPoint: path.join(ROOT, 'src', 'index.ts'), publicDir: PUBLIC});
	return serveUrl;
};

/** One render job at a time; each item is a category. */
const job = {running: false, items: [], message: ''};

const runQueue = async (categories) => {
	job.running = true;
	job.items = categories.map((c) => ({id: c.id, title: c.title, status: 'queued', progress: 0, file: null, error: null}));
	try {
		const {selectComposition, renderMedia, ensureBrowser} = await import('@remotion/renderer');
		if (!BROWSER) {
			job.message = 'Downloading render browser (first time only)…';
			await ensureBrowser();
		}
		const url = await getServeUrl();
		for (const [i, c] of categories.entries()) {
			const item = job.items[i];
			item.status = 'rendering';
			job.message = `Rendering ${c.title}`;
			try {
				const inputProps = {category: c, nomineeFrames: []};
				const composition = await selectComposition({serveUrl: url, id: 'category', inputProps, browserExecutable: BROWSER});
				const file = `${c.id}.mp4`;
				await renderMedia({
					serveUrl: url,
					composition,
					inputProps,
					codec: 'h264',
					crf: 16,
					imageFormat: 'jpeg',
					outputLocation: path.join(OUT, file),
					browserExecutable: BROWSER,
					onProgress: ({progress}) => {
						item.progress = progress;
					},
				});
				item.status = 'done';
				item.progress = 1;
				item.file = file;
			} catch (e) {
				item.status = 'error';
				item.error = String(e?.message || e).split('\n')[0];
				console.error(e);
			}
		}
		job.message = 'Finished';
	} catch (e) {
		job.message = `Could not start rendering: ${String(e?.message || e).split('\n')[0]}`;
		for (const it of job.items) if (it.status === 'queued') it.status = 'error';
		console.error(e);
	} finally {
		job.running = false;
	}
};

// ---------- helpers ----------
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.mp4': 'video/mp4',
	'.mov': 'video/quicktime',
	'.m4v': 'video/mp4',
	'.webm': 'video/webm',
	'.m4a': 'audio/mp4',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.png': 'image/png',
};

const sendJson = (res, code, obj) => {
	res.writeHead(code, {'content-type': 'application/json'});
	res.end(JSON.stringify(obj));
};

const readBody = (req) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});

/** Serve a file, with byte ranges so videos can be scrubbed. */
const serveFile = (req, res, file, extraHeaders = {}) => {
	fs.stat(file, (err, st) => {
		if (err || !st.isFile()) {
			res.writeHead(404);
			return res.end('Not found');
		}
		const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
		const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
		if (range) {
			const start = range[1] ? Number(range[1]) : 0;
			const end = range[2] ? Number(range[2]) : st.size - 1;
			res.writeHead(206, {
				'content-type': type,
				'content-range': `bytes ${start}-${end}/${st.size}`,
				'accept-ranges': 'bytes',
				'content-length': end - start + 1,
				...extraHeaders,
			});
			fs.createReadStream(file, {start, end}).pipe(res);
		} else {
			res.writeHead(200, {'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes', ...extraHeaders});
			fs.createReadStream(file).pipe(res);
		}
	});
};

/** Resolve a URL path inside a base folder, refusing anything that escapes it. */
const inside = (base, rel) => {
	const p = path.resolve(base, '.' + path.posix.normalize('/' + decodeURIComponent(rel)));
	return p.startsWith(base + path.sep) ? p : null;
};

const safeName = (name) => {
	const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.mp4';
	const stem =
		path
			.basename(name, path.extname(name))
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'clip';
	let candidate = `${stem}${ext}`;
	for (let i = 2; fs.existsSync(path.join(CLIPS, candidate)); i++) candidate = `${stem}-${i}${ext}`;
	return candidate;
};

const openPath = (p) => {
	const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
	try {
		spawn(cmd, [p], {detached: true, stdio: 'ignore'}).on('error', () => {}).unref();
	} catch {}
};

const validId = (id) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id);

// ---------- server ----------
const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, 'http://localhost');
	const p = url.pathname;
	try {
		if (p === '/' || p === '/index.html') return serveFile(req, res, path.join(ROOT, 'app', 'ui', 'index.html'));
		if (p.startsWith('/app/')) {
			const f = inside(UI_BUILD, p.slice(5));
			return f ? serveFile(req, res, f) : sendJson(res, 400, {error: 'bad path'});
		}

		if (p === '/api/project' && req.method === 'GET') {
			return sendJson(res, 200, JSON.parse(fs.readFileSync(DATA, 'utf8')));
		}
		if (p === '/api/project' && req.method === 'PUT') {
			const data = JSON.parse(await readBody(req));
			if (!Array.isArray(data.categories)) return sendJson(res, 400, {error: 'categories missing'});
			const tmp = DATA + '.tmp';
			fs.writeFileSync(tmp, JSON.stringify(data, null, '\t') + '\n');
			fs.renameSync(tmp, DATA);
			return sendJson(res, 200, {ok: true});
		}
		if (p === '/api/upload' && req.method === 'POST') {
			const name = safeName(url.searchParams.get('name') || 'clip.mp4');
			const target = path.join(CLIPS, name);
			const out = fs.createWriteStream(target);
			req.pipe(out);
			out.on('finish', () => sendJson(res, 200, {file: name}));
			out.on('error', (e) => sendJson(res, 500, {error: String(e)}));
			return;
		}
		if (p === '/api/clips' && req.method === 'GET') {
			const files = fs.readdirSync(CLIPS).filter((f) => !f.startsWith('.'));
			return sendJson(res, 200, {files});
		}
		if (p === '/api/render' && req.method === 'POST') {
			if (job.running) return sendJson(res, 409, {error: 'A render is already running'});
			const {categories} = JSON.parse(await readBody(req));
			if (!Array.isArray(categories) || !categories.length || !categories.every((c) => validId(c.id)))
				return sendJson(res, 400, {error: 'Nothing to render'});
			runQueue(categories);
			return sendJson(res, 200, {ok: true});
		}
		if (p === '/api/render' && req.method === 'GET') return sendJson(res, 200, job);
		if (p === '/api/open-output' && req.method === 'POST') {
			openPath(OUT);
			return sendJson(res, 200, {ok: true});
		}
		if (p.startsWith('/out/')) {
			const f = inside(OUT, p.slice(5));
			if (!f) return sendJson(res, 400, {error: 'bad path'});
			const dl = url.searchParams.has('download') ? {'content-disposition': `attachment; filename="${path.basename(f)}"`} : {};
			return serveFile(req, res, f, dl);
		}
		// Everything else: the project's public folder (clips, music) for the preview.
		const f = inside(PUBLIC, p.slice(1));
		if (f) return serveFile(req, res, f);
		res.writeHead(404);
		res.end('Not found');
	} catch (e) {
		console.error(e);
		sendJson(res, 500, {error: String(e?.message || e)});
	}
});

server.listen(PORT, '127.0.0.1', () => {
	const link = `http://localhost:${PORT}`;
	console.log(`\n  Awards Video is running at ${link}\n  Keep this window open while you work. Close it to stop.\n`);
	if (!process.env.NO_OPEN) openPath(link);
});
