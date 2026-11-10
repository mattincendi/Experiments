import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import './style.css';
import {CategoryVideo} from '../../src/CategoryVideo';
import {computeNomineeFrames, totalFrames} from '../../src/frames';
import {FPS, HEIGHT, WIDTH} from '../../src/theme';
import type {Category, Nominee} from '../../src/types';
import {loadProject, openOutput, Project, RenderJob, renderStatus, saveProject, startRender, uploadClip} from './api';

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'category';

/** Give every category a unique file-safe id derived from its title. */
const withIds = (cats: Category[]): Category[] => {
	const used = new Set<string>();
	return cats.map((c) => {
		let id = slug(c.title);
		for (let i = 2; used.has(id); i++) id = `${slug(c.title)}-${i}`;
		used.add(id);
		return {...c, id};
	});
};

const nameFromFile = (f: string) =>
	f
		.replace(/\.[^.]+$/, '')
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (m) => m.toUpperCase());

// ---------------------------------------------------------------- preview

const Preview: React.FC<{category: Category}> = ({category}) => {
	const [frames, setFrames] = useState<number[] | null>(null);
	const key = JSON.stringify(category);
	useEffect(() => {
		let live = true;
		setFrames(null);
		const t = setTimeout(() => {
			computeNomineeFrames(category).then((f) => live && setFrames(f));
		}, 350);
		return () => {
			live = false;
			clearTimeout(t);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	if (!frames) return <div className="preview-wait">Loading preview…</div>;
	const seconds = Math.round(totalFrames(frames) / FPS);
	return (
		<>
			<Player
				component={CategoryVideo}
				inputProps={{category, nomineeFrames: frames}}
				durationInFrames={totalFrames(frames)}
				fps={FPS}
				compositionWidth={WIDTH}
				compositionHeight={HEIGHT}
				controls
				style={{width: '100%', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden'}}
				acknowledgeRemotionLicense
			/>
			<div className="muted small">
				Length {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}. The preview may stutter; the rendered video won’t.
			</div>
		</>
	);
};

// ---------------------------------------------------------------- nominee row

const ClipDrop: React.FC<{clip?: string; onFile: (f: File) => void; onClear: () => void}> = ({clip, onFile, onClear}) => {
	const [over, setOver] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	return (
		<div
			className={`clip-drop ${over ? 'over' : ''} ${clip ? 'has' : ''}`}
			onDragOver={(e) => {
				e.preventDefault();
				e.stopPropagation();
				setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				e.stopPropagation();
				setOver(false);
				const f = e.dataTransfer.files[0];
				if (f) onFile(f);
			}}
			onClick={() => input.current?.click()}
		>
			<input
				ref={input}
				type="file"
				accept="video/*"
				hidden
				onChange={(e) => {
					const f = e.target.files?.[0];
					if (f) onFile(f);
					e.target.value = '';
				}}
			/>
			{clip ? (
				<>
					<video src={`/clips/${clip}#t=1`} muted preload="metadata" />
					<span className="clip-name" title={clip}>
						{clip}
					</span>
					<button
						className="link"
						onClick={(e) => {
							e.stopPropagation();
							onClear();
						}}
					>
						Remove
					</button>
				</>
			) : (
				<span>Drop a video here, or click to choose</span>
			)}
		</div>
	);
};

const NomineeRow: React.FC<{
	n: Nominee;
	index: number;
	count: number;
	onChange: (n: Nominee) => void;
	onMove: (d: -1 | 1) => void;
	onDelete: () => void;
}> = ({n, index, count, onChange, onMove, onDelete}) => {
	const [upload, setUpload] = useState<number | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const onFile = async (f: File) => {
		if (!VIDEO_EXT.test(f.name)) return setErr('Please use an MP4, MOV, M4V or WebM video.');
		setErr(null);
		setUpload(0);
		try {
			const file = await uploadClip(f, setUpload);
			onChange({...n, clip: file});
		} catch (e) {
			setErr(String((e as Error).message));
		} finally {
			setUpload(null);
		}
	};
	const num = (v: string) => (v === '' ? undefined : Math.max(0, Number(v)));
	return (
		<div className="nominee">
			<div className="nominee-num">{index + 1}</div>
			<div className="nominee-fields">
				<label>
					Name
					<input value={n.name} onChange={(e) => onChange({...n, name: e.target.value})} placeholder="Nominee name" />
				</label>
				<label>
					Second line <span className="muted">(optional)</span>
					<input value={n.detail ?? ''} onChange={(e) => onChange({...n, detail: e.target.value || undefined})} placeholder="e.g. team, role or film" />
				</label>
				<div className="trim">
					<label>
						Start at (sec)
						<input type="number" min={0} step={0.5} value={n.startAt ?? ''} placeholder="0" onChange={(e) => onChange({...n, startAt: num(e.target.value)})} />
					</label>
					<label>
						Max length (sec)
						<input type="number" min={2} step={0.5} value={n.maxSeconds ?? ''} placeholder="full clip" onChange={(e) => onChange({...n, maxSeconds: num(e.target.value)})} />
					</label>
				</div>
			</div>
			<div className="nominee-clip">
				{upload !== null ? (
					<div className="clip-drop">
						<span>Uploading… {Math.round(upload * 100)}%</span>
						<div className="bar"><div style={{width: `${upload * 100}%`}} /></div>
					</div>
				) : (
					<ClipDrop clip={n.clip} onFile={onFile} onClear={() => onChange({...n, clip: undefined})} />
				)}
				{err ? <div className="error small">{err}</div> : null}
			</div>
			<div className="row-actions">
				<button title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
				<button title="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>↓</button>
				<button title="Delete nominee" className="danger" onClick={onDelete}>✕</button>
			</div>
		</div>
	);
};

// ---------------------------------------------------------------- render panel

const RenderPanel: React.FC<{job: RenderJob | null}> = ({job}) => {
	if (!job || !job.items.length) return null;
	return (
		<div className="render-panel">
			<div className="render-head">
				<strong>{job.running ? job.message || 'Rendering…' : 'Renders'}</strong>
				<button className="link" onClick={() => openOutput()}>Open output folder</button>
			</div>
			{job.items.map((it) => (
				<div key={it.id} className="render-item">
					<span className="render-title">{it.title}</span>
					{it.status === 'done' && it.file ? (
						<span className="render-links">
							<a href={`/out/${it.file}`} target="_blank" rel="noreferrer">Watch</a>
							<a href={`/out/${it.file}?download`}>Download</a>
						</span>
					) : it.status === 'error' ? (
						<span className="error small" title={it.error ?? ''}>Failed{it.error ? `: ${it.error}` : ''}</span>
					) : (
						<div className="bar wide">
							<div style={{width: `${Math.round(it.progress * 100)}%`}} />
							<span>{it.status === 'queued' ? 'Waiting' : `${Math.round(it.progress * 100)}%`}</span>
						</div>
					)}
				</div>
			))}
		</div>
	);
};

// ---------------------------------------------------------------- app

const App: React.FC = () => {
	const [project, setProject] = useState<Project | null>(null);
	const [sel, setSel] = useState(0);
	const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
	const [job, setJob] = useState<RenderJob | null>(null);
	const [bulkOver, setBulkOver] = useState(false);
	const [bulkMsg, setBulkMsg] = useState<string | null>(null);
	const first = useRef(true);

	useEffect(() => {
		loadProject().then((p) => setProject({categories: withIds(p.categories ?? [])}));
		renderStatus().then(setJob).catch(() => {});
	}, []);

	// Autosave.
	useEffect(() => {
		if (!project) return;
		if (first.current) {
			first.current = false;
			return;
		}
		setSaved('saving');
		const t = setTimeout(() => {
			saveProject(project).then(() => setSaved('saved')).catch(() => setSaved('error'));
		}, 500);
		return () => clearTimeout(t);
	}, [project]);

	// Poll render progress while a render runs.
	useEffect(() => {
		if (!job?.running) return;
		const t = setInterval(() => renderStatus().then(setJob).catch(() => {}), 1000);
		return () => clearInterval(t);
	}, [job?.running]);

	const cats = project?.categories ?? [];
	const cat = cats[Math.min(sel, cats.length - 1)];

	const setCats = useCallback((fn: (c: Category[]) => Category[]) => {
		setProject((p) => (p ? {categories: withIds(fn(p.categories))} : p));
	}, []);
	const updateCat = (c: Category) => setCats((all) => all.map((x, i) => (i === sel ? c : x)));
	const move = <T,>(arr: T[], i: number, d: number) => {
		const a = [...arr];
		const j = i + d;
		if (j < 0 || j >= a.length) return a;
		[a[i], a[j]] = [a[j], a[i]];
		return a;
	};

	const render = async (list: Category[]) => {
		try {
			await saveProject({categories: cats});
			await startRender(list);
			setJob(await renderStatus());
		} catch (e) {
			alert(String((e as Error).message));
		}
	};

	const bulkAdd = async (files: FileList) => {
		if (!cat) return;
		const vids = [...files].filter((f) => VIDEO_EXT.test(f.name));
		if (!vids.length) return;
		const added: Nominee[] = [];
		for (const [i, f] of vids.entries()) {
			setBulkMsg(`Uploading ${i + 1} of ${vids.length}: ${f.name}`);
			try {
				const file = await uploadClip(f, () => {});
				added.push({name: nameFromFile(f.name), clip: file});
			} catch {
				setBulkMsg(`Couldn't upload ${f.name}`);
			}
		}
		setBulkMsg(null);
		const id = cat.id;
		setCats((all) => all.map((c) => (c.id === id ? {...c, nominees: [...c.nominees, ...added]} : c)));
	};

	const previewCat = useMemo(() => cat, [JSON.stringify(cat)]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!project) return <div className="loading">Loading…</div>;

	return (
		<div className="app">
			<aside className="sidebar">
				<div className="brand">
					Awards <span>Video</span>
				</div>
				<div className="section-label">Categories</div>
				<ul className="cat-list">
					{cats.map((c, i) => (
						<li key={i} className={i === sel ? 'active' : ''} onClick={() => setSel(i)}>
							<span className="cat-title">{c.title || 'Untitled'}</span>
							<span className="cat-count">{c.nominees.length}</span>
						</li>
					))}
				</ul>
				<button
					className="add"
					onClick={() => {
						setCats((all) => [...all, {id: '', title: 'New Category', nominees: [{name: 'Nominee One'}]}]);
						setSel(cats.length);
					}}
				>
					+ Add category
				</button>
				<div className="sidebar-foot">
					<button className="primary" disabled={!cats.length || job?.running} onClick={() => render(cats)}>
						Render all ({cats.length})
					</button>
					<div className={`save ${saved}`}>{saved === 'saved' ? 'All changes saved' : saved === 'saving' ? 'Saving…' : 'Could not save, is the app still running?'}</div>
				</div>
			</aside>

			<main className="main">
				{cat ? (
					<>
						<div className="cat-head">
							<label className="grow">
								Category name
								<input className="big" value={cat.title} onChange={(e) => updateCat({...cat, title: e.target.value})} />
							</label>
							<label>
								Line above the name
								<input value={cat.kicker ?? ''} placeholder="The nominees for" onChange={(e) => updateCat({...cat, kicker: e.target.value || undefined})} />
							</label>
							<div className="cat-actions">
								<button title="Move category up" disabled={sel === 0} onClick={() => { setCats((a) => move(a, sel, -1)); setSel(sel - 1); }}>↑</button>
								<button title="Move category down" disabled={sel === cats.length - 1} onClick={() => { setCats((a) => move(a, sel, 1)); setSel(sel + 1); }}>↓</button>
								<button
									className="danger"
									onClick={() => {
										if (!confirm(`Delete the category "${cat.title}"? Its clips stay on your computer.`)) return;
										setCats((a) => a.filter((_, i) => i !== sel));
										setSel(Math.max(0, sel - 1));
									}}
								>
									Delete
								</button>
							</div>
						</div>

						<div className="columns">
							<section className="nominees">
								<div className="section-label">Nominees</div>
								{cat.nominees.map((n, i) => (
									<NomineeRow
										key={i}
										n={n}
										index={i}
										count={cat.nominees.length}
										onChange={(nn) => updateCat({...cat, nominees: cat.nominees.map((x, j) => (j === i ? nn : x))})}
										onMove={(d) => updateCat({...cat, nominees: move(cat.nominees, i, d)})}
										onDelete={() => updateCat({...cat, nominees: cat.nominees.filter((_, j) => j !== i)})}
									/>
								))}
								<div
									className={`bulk ${bulkOver ? 'over' : ''}`}
									onDragOver={(e) => {
										e.preventDefault();
										setBulkOver(true);
									}}
									onDragLeave={() => setBulkOver(false)}
									onDrop={(e) => {
										e.preventDefault();
										setBulkOver(false);
										bulkAdd(e.dataTransfer.files);
									}}
								>
									<button onClick={() => updateCat({...cat, nominees: [...cat.nominees, {name: `Nominee ${cat.nominees.length + 1}`}]})}>
										+ Add nominee
									</button>
									<span className="muted">{bulkMsg ?? 'or drop several clips here to add one nominee per clip'}</span>
								</div>
							</section>

							<section className="preview">
								<div className="section-label">Preview</div>
								{previewCat ? <Preview category={previewCat} /> : null}
								<button className="primary wide" disabled={job?.running} onClick={() => render([cat])}>
									Render “{cat.title}”
								</button>
								<RenderPanel job={job} />
							</section>
						</div>
					</>
				) : (
					<div className="empty">Add a category to get started.</div>
				)}
			</main>
		</div>
	);
};

createRoot(document.getElementById('root')!).render(<App />);
