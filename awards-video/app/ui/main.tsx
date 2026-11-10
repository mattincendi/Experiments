import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import './style.css';
import {CategoryVideo} from '../../src/CategoryVideo';
import {WinnerVideo} from '../../src/WinnerVideo';
import {ScreenVideo} from '../../src/ScreenVideo';
import {clipFrames, computeNomineeFrames, onStageScreen, screenFrames, screenLabel, screenLoops, totalFrames, upNextScreen, winnerTotalFrames} from '../../src/frames';
import {FPS, HEIGHT, WIDTH} from '../../src/theme';
import type {Category, EventInfo, Nominee, Project, Screen} from '../../src/types';
import {loadProject, openOutput, RenderJob, renderStatus, saveProject, startRender, uploadClip, VideoJob} from './api';

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'untitled';

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

const screenIds = (screens: Screen[]) => {
	const used = new Set<string>();
	return screens.map((s) => {
		const base = `screen-${slug(screenLabel(s))}`;
		let id = base;
		for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
		used.add(id);
		return id;
	});
};

const normalize = (p: Partial<Project>): Project => ({
	event: p.event ?? {title: 'Awards Night', subtitle: ''},
	screens: p.screens ?? [{type: 'title'}, {type: 'background'}],
	categories: withIds(p.categories ?? []),
});

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const nameFromFile = (f: string) =>
	f
		.replace(/\.[^.]+$/, '')
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (m) => m.toUpperCase());

const move = <T,>(arr: T[], i: number, d: number) => {
	const a = [...arr];
	const j = i + d;
	if (j < 0 || j >= a.length) return a;
	[a[i], a[j]] = [a[j], a[i]];
	return a;
};

// Render jobs
const categoryJob = (c: Category): VideoJob => ({file: `${c.id}.mp4`, title: c.title, composition: 'category', inputProps: {category: c, nomineeFrames: []}});
const winnerJob = (c: Category): VideoJob => ({file: `${c.id}-winner.mp4`, title: `${c.title}: winner`, composition: 'winner', inputProps: {category: c, clipFrames: 1}});
const upNextJob = (c: Category, event: EventInfo): VideoJob => ({file: `${c.id}-up-next.mp4`, title: `${c.title}: up next`, composition: 'screen', inputProps: {screen: upNextScreen(c), event}});
const onStageJob = (c: Category, event: EventInfo): VideoJob => ({file: `${c.id}-in-progress.mp4`, title: `${c.title}: award in progress`, composition: 'screen', inputProps: {screen: onStageScreen(c), event}});
const screenJob = (s: Screen, id: string, event: EventInfo): VideoJob => ({file: `${id}.mp4`, title: screenLabel(s), composition: 'screen', inputProps: {screen: s, event}});

// ---------------------------------------------------------------- fields that commit when you leave them

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {value: string | undefined; onCommit: (v: string) => void};

/** Text input that only reports its value when you leave it or press Enter. */
const Field: React.FC<FieldProps> = ({value, onCommit, ...rest}) => {
	const [draft, setDraft] = useState(value ?? '');
	useEffect(() => setDraft(value ?? ''), [value]);
	return (
		<input
			{...rest}
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => draft !== (value ?? '') && onCommit(draft)}
			onKeyDown={(e) => {
				if (e.key === 'Enter') e.currentTarget.blur();
				if (e.key === 'Escape') {
					setDraft(value ?? '');
					setTimeout(() => (e.target as HTMLInputElement).blur());
				}
			}}
		/>
	);
};

const NumField: React.FC<Omit<FieldProps, 'value' | 'onCommit'> & {value: number | undefined; onCommit: (v: number | undefined) => void}> = ({value, onCommit, ...rest}) => (
	<Field {...rest} type="number" value={value === undefined ? '' : String(value)} onCommit={(v) => onCommit(v === '' ? undefined : Math.max(0, Number(v)))} />
);

// ---------------------------------------------------------------- preview

type PreviewTarget =
	| {kind: 'category'; category: Category}
	| {kind: 'winner'; category: Category}
	| {kind: 'screen'; screen: Screen; event: EventInfo};

const Preview: React.FC<{target: PreviewTarget}> = ({target}) => {
	const [data, setData] = useState<{frames: number; props: Record<string, unknown>} | null>(null);
	const key = JSON.stringify(target);
	useEffect(() => {
		let live = true;
		setData(null);
		(async () => {
			if (target.kind === 'category') {
				const nf = await computeNomineeFrames(target.category);
				return {frames: totalFrames(nf), props: {category: target.category, nomineeFrames: nf}};
			}
			if (target.kind === 'winner') {
				const f = await clipFrames(target.category.winner ?? {name: ''});
				return {frames: winnerTotalFrames(f), props: {category: target.category, clipFrames: f}};
			}
			return {frames: screenFrames(target.screen), props: {screen: target.screen, event: target.event}};
		})().then((d) => live && setData(d));
		return () => {
			live = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	if (!data) return <div className="preview-wait">Loading preview…</div>;
	const component = (target.kind === 'category' ? CategoryVideo : target.kind === 'winner' ? WinnerVideo : ScreenVideo) as React.FC<Record<string, unknown>>;
	const seconds = Math.round(data.frames / FPS);
	const loops = target.kind === 'screen' && screenLoops(target.screen);
	return (
		<>
			<Player
				component={component}
				inputProps={data.props}
				durationInFrames={data.frames}
				fps={FPS}
				compositionWidth={WIDTH}
				compositionHeight={HEIGHT}
				controls
				loop={loops}
				style={{width: '100%', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden'}}
				acknowledgeRemotionLicense
			/>
			<div className="muted small">
				Length {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
				{loops ? ', loops seamlessly' : ''}. The preview may stutter; the rendered video won’t.
			</div>
		</>
	);
};

// ---------------------------------------------------------------- clip editing

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

const PersonCard: React.FC<{
	n: Nominee;
	badge: string;
	onChange: (n: Nominee) => void;
	actions?: React.ReactNode;
}> = ({n, badge, onChange, actions}) => {
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
	return (
		<div className="nominee">
			<div className="nominee-num">{badge}</div>
			<div className="nominee-fields">
				<label>
					Name
					<Field value={n.name} onCommit={(v) => onChange({...n, name: v})} placeholder="Name" />
				</label>
				<label>
					Second line <span className="muted">(optional)</span>
					<Field value={n.detail} onCommit={(v) => onChange({...n, detail: v || undefined})} placeholder="e.g. team, role or film" />
				</label>
				<div className="trim">
					<label>
						Start at (sec)
						<NumField min={0} step={0.5} value={n.startAt} placeholder="0" onCommit={(v) => onChange({...n, startAt: v})} />
					</label>
					<label>
						Max length (sec)
						<NumField min={2} step={0.5} value={n.maxSeconds} placeholder="full clip" onCommit={(v) => onChange({...n, maxSeconds: v})} />
					</label>
				</div>
			</div>
			<div className="nominee-clip">
				{upload !== null ? (
					<div className="clip-drop">
						<span>Uploading… {Math.round(upload * 100)}%</span>
						<div className="bar">
							<div style={{width: `${upload * 100}%`}} />
						</div>
					</div>
				) : (
					<ClipDrop clip={n.clip} onFile={onFile} onClear={() => onChange({...n, clip: undefined})} />
				)}
				{err ? <div className="error small">{err}</div> : null}
			</div>
			<div className="row-actions">{actions}</div>
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
				<button className="link" onClick={() => openOutput()}>
					Open output folder
				</button>
			</div>
			{job.items.map((it) => (
				<div key={it.id} className="render-item">
					<span className="render-title">{it.title}</span>
					{it.status === 'done' && it.file ? (
						<span className="render-links">
							<a href={`/out/${it.file}`} target="_blank" rel="noreferrer">
								Watch
							</a>
							<a href={`/out/${it.file}?download`}>Download</a>
						</span>
					) : it.status === 'error' ? (
						<span className="error small" title={it.error ?? ''}>
							Failed{it.error ? `: ${it.error}` : ''}
						</span>
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

// ---------------------------------------------------------------- screens

const SCREEN_HELP: Record<Screen['type'], string> = {
	title: 'Your event name, for the LED wall before and between segments.',
	background: 'Just the moving background, for behind presenters and speeches.',
	message: 'Any text, e.g. Welcome, Intermission, Dinner is served.',
	countdown: 'Counts down to the start, then holds on 0:00.',
	upnext: '',
	onstage: '',
};

const ScreensView: React.FC<{
	project: Project;
	update: (fn: (p: Project) => Project) => void;
	render: (jobs: (p: Project) => VideoJob[]) => void;
	job: RenderJob | null;
}> = ({project, update, render, job}) => {
	const [sel, setSel] = useState(0);
	const {event, screens} = project;
	const ids = screenIds(screens);
	const cur = screens[Math.min(sel, screens.length - 1)];
	const setScreen = (i: number, s: Screen) => update((p) => ({...p, screens: p.screens.map((x, j) => (j === i ? s : x))}));
	const add = (s: Screen) => {
		update((p) => ({...p, screens: [...p.screens, s]}));
		setSel(screens.length);
	};
	return (
		<>
			<div className="cat-head">
				<label className="grow">
					Event name
					<Field className="big" value={event.title} onCommit={(v) => update((p) => ({...p, event: {...p.event, title: v}}))} />
				</label>
				<label>
					Subtitle <span className="muted">(e.g. year)</span>
					<Field value={event.subtitle} onCommit={(v) => update((p) => ({...p, event: {...p.event, subtitle: v}}))} />
				</label>
			</div>
			<div className="columns">
				<section>
					<div className="section-label">LED wall screens</div>
					{screens.map((s, i) => (
						<div key={i} className={`screen-card ${i === sel ? 'active' : ''}`} onClick={() => setSel(i)}>
							<div className="screen-top">
								<strong>{screenLabel(s)}</strong>
								<span className="row-actions inline">
									<button title="Move up" disabled={i === 0} onClick={(e) => (e.stopPropagation(), update((p) => ({...p, screens: move(p.screens, i, -1)})), setSel(i - 1))}>
										↑
									</button>
									<button
										title="Move down"
										disabled={i === screens.length - 1}
										onClick={(e) => (e.stopPropagation(), update((p) => ({...p, screens: move(p.screens, i, 1)})), setSel(i + 1))}
									>
										↓
									</button>
									<button
										className="danger"
										title="Delete"
										onClick={(e) => {
											e.stopPropagation();
											update((p) => ({...p, screens: p.screens.filter((_, j) => j !== i)}));
											setSel(Math.max(0, i - 1));
										}}
									>
										✕
									</button>
								</span>
							</div>
							<div className="muted small">{SCREEN_HELP[s.type]}</div>
							{s.type === 'message' ? (
								<div className="trim">
									<label>
										Main text
										<Field value={s.text} onCommit={(v) => setScreen(i, {...s, text: v})} />
									</label>
									<label>
										Line underneath
										<Field value={s.subtext} onCommit={(v) => setScreen(i, {...s, subtext: v || undefined})} />
									</label>
								</div>
							) : null}
							{s.type === 'countdown' ? (
								<div className="trim">
									<label>
										Text above
										<Field value={s.text} placeholder="The ceremony begins in" onCommit={(v) => setScreen(i, {...s, text: v || undefined})} />
									</label>
									<label>
										Minutes
										<NumField min={1} step={1} value={s.minutes} onCommit={(v) => setScreen(i, {...s, minutes: Math.max(1, v ?? 5)})} />
									</label>
								</div>
							) : null}
						</div>
					))}
					<div className="bulk">
						<span className="muted">Add:</span>
						<button onClick={() => add({type: 'message', text: 'Welcome', subtext: 'Please take your seats'})}>Message</button>
						<button onClick={() => add({type: 'countdown', text: 'The ceremony begins in', minutes: 5})}>Countdown</button>
						<button onClick={() => add({type: 'title'})}>Title screen</button>
						<button onClick={() => add({type: 'background'})}>Background</button>
					</div>
				</section>
				<section className="preview">
					<div className="section-label">Preview</div>
					{cur ? <Preview target={{kind: 'screen', screen: cur, event}} /> : <div className="preview-wait">Add a screen</div>}
					{cur ? (
						<button className="primary wide" disabled={job?.running} onClick={() => render((p) => [screenJob(p.screens[sel], screenIds(p.screens)[sel], p.event)])}>
							Render “{screenLabel(cur)}”
						</button>
					) : null}
					<button className="wide" disabled={job?.running || !screens.length} onClick={() => render((p) => p.screens.map((s, i) => screenJob(s, screenIds(p.screens)[i], p.event)))}>
						Render all screens ({screens.length})
					</button>
					<div className="muted small" style={{marginTop: 8}}>
						Loops are 48 seconds and repeat seamlessly, so set your player to loop. Files: {ids.slice(0, 2).join('.mp4, ')}.mp4…
					</div>
					<RenderPanel job={job} />
				</section>
			</div>
		</>
	);
};

// ---------------------------------------------------------------- category

const CategoryView: React.FC<{
	cat: Category;
	event: EventInfo;
	index: number;
	count: number;
	update: (fn: (p: Project) => Project) => void;
	render: (jobs: (p: Project) => VideoJob[]) => void;
	select: (i: number) => void;
	job: RenderJob | null;
}> = ({cat, event, index, count, update, render, select, job}) => {
	const [tab, setTab] = useState<'nominees' | 'winner' | 'night'>('nominees');
	const [nightSel, setNightSel] = useState<'upnext' | 'onstage'>('upnext');
	const [bulkOver, setBulkOver] = useState(false);
	const [bulkMsg, setBulkMsg] = useState<string | null>(null);
	const updateCat = (fn: (c: Category) => Category) =>
		update((p) => ({...p, categories: withIds(p.categories.map((c, i) => (i === index ? fn(c) : c)))}));

	const bulkAdd = async (files: FileList) => {
		const vids = [...files].filter((f) => VIDEO_EXT.test(f.name));
		const added: Nominee[] = [];
		for (const [i, f] of vids.entries()) {
			setBulkMsg(`Uploading ${i + 1} of ${vids.length}: ${f.name}`);
			try {
				added.push({name: nameFromFile(f.name), clip: await uploadClip(f, () => {})});
			} catch {
				setBulkMsg(`Couldn't upload ${f.name}`);
			}
		}
		setBulkMsg(null);
		updateCat((c) => ({...c, nominees: [...c.nominees, ...added]}));
	};

	const previewTarget = useMemo<PreviewTarget>(
		() =>
			tab === 'night'
				? {kind: 'screen', screen: nightSel === 'upnext' ? upNextScreen(cat) : onStageScreen(cat), event}
				: {kind: tab === 'nominees' ? 'category' : 'winner', category: cat},
		[tab, nightSel, JSON.stringify(cat), JSON.stringify(event)], // eslint-disable-line react-hooks/exhaustive-deps
	);

	return (
		<>
			<div className="cat-head">
				<label className="grow">
					Category name
					<Field className="big" value={cat.title} onCommit={(v) => updateCat((c) => ({...c, title: v}))} />
				</label>
				<div className="cat-actions">
					<button title="Move category up" disabled={index === 0} onClick={() => (update((p) => ({...p, categories: withIds(move(p.categories, index, -1))})), select(index - 1))}>
						↑
					</button>
					<button title="Move category down" disabled={index === count - 1} onClick={() => (update((p) => ({...p, categories: withIds(move(p.categories, index, 1))})), select(index + 1))}>
						↓
					</button>
					<button
						className="danger"
						onClick={() => {
							if (!confirm(`Delete the category "${cat.title}"? Its clips stay on your computer.`)) return;
							update((p) => ({...p, categories: withIds(p.categories.filter((_, i) => i !== index))}));
							select(Math.max(0, index - 1));
						}}
					>
						Delete
					</button>
				</div>
			</div>

			<div className="tabs">
				<button className={tab === 'nominees' ? 'on' : ''} onClick={() => setTab('nominees')}>
					Nominees video
				</button>
				<button className={tab === 'winner' ? 'on' : ''} onClick={() => setTab('winner')}>
					Winner video {cat.winner ? '' : <span className="muted">(not set)</span>}
				</button>
				<button className={tab === 'night' ? 'on' : ''} onClick={() => setTab('night')}>
					On the night
				</button>
			</div>

			<div className="columns">
				{tab === 'nominees' ? (
					<section className="nominees">
						<div className="trim" style={{marginBottom: 14}}>
							<label>
								Line above the name at the start
								<Field value={cat.kicker} placeholder="The nominees for" onCommit={(v) => updateCat((c) => ({...c, kicker: v || undefined}))} />
							</label>
							<label>
								Line above the name at the end
								<Field value={cat.outroKicker} placeholder="And the award for" onCommit={(v) => updateCat((c) => ({...c, outroKicker: v || undefined}))} />
							</label>
						</div>
						{cat.nominees.map((n, i) => (
							<PersonCard
								key={i}
								n={n}
								badge={String(i + 1)}
								onChange={(nn) => updateCat((c) => ({...c, nominees: c.nominees.map((x, j) => (j === i ? nn : x))}))}
								actions={
									<>
										<button title="Move up" disabled={i === 0} onClick={() => updateCat((c) => ({...c, nominees: move(c.nominees, i, -1)}))}>
											↑
										</button>
										<button title="Move down" disabled={i === cat.nominees.length - 1} onClick={() => updateCat((c) => ({...c, nominees: move(c.nominees, i, 1)}))}>
											↓
										</button>
										<button title="Delete nominee" className="danger" onClick={() => updateCat((c) => ({...c, nominees: c.nominees.filter((_, j) => j !== i)}))}>
											✕
										</button>
									</>
								}
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
							<button onClick={() => updateCat((c) => ({...c, nominees: [...c.nominees, {name: `Nominee ${c.nominees.length + 1}`}]}))}>+ Add nominee</button>
							<span className="muted">{bulkMsg ?? 'or drop several clips here to add one nominee per clip'}</span>
						</div>
					</section>
				) : tab === 'night' ? (
					<section className="nominees">
						<p className="muted small" style={{marginTop: 0}}>
							Extra screens for this award. Click one to preview it.
						</p>
						<div className={`screen-card ${nightSel === 'upnext' ? 'active' : ''}`} onClick={() => setNightSel('upnext')}>
							<div className="screen-top">
								<strong>Up next</strong>
								<span className="muted small">8 sec, holds on the last frame</span>
							</div>
							<div className="muted small">Play it before the presenters walk on. The award name animates in and stays on screen. Saved as <code>{cat.id}-up-next.mp4</code>.</div>
							<label>
								Line above the name
								<Field value={cat.upNextKicker} placeholder="Up next" onCommit={(v) => updateCat((c) => ({...c, upNextKicker: v || undefined}))} />
							</label>
						</div>
						<div className={`screen-card ${nightSel === 'onstage' ? 'active' : ''}`} onClick={() => setNightSel('onstage')}>
							<div className="screen-top">
								<strong>Award in progress</strong>
								<span className="muted small">48 sec seamless loop</span>
							</div>
							<div className="muted small">
								Leave it on the LED wall during the award and the speech. Saved as <code>{cat.id}-in-progress.mp4</code>.
							</div>
							<label className="check" onClick={(e) => e.stopPropagation()}>
								<input
									type="checkbox"
									checked={!!cat.onStageShowWinner}
									disabled={!cat.winner}
									onChange={(e) => {
										updateCat((c) => ({...c, onStageShowWinner: e.target.checked}));
										setNightSel('onstage');
									}}
								/>
								Show the winner’s name {cat.winner ? `(${cat.winner.name})` : '(set a winner on the Winner video tab first)'}
							</label>
						</div>
					</section>
				) : (
					<section className="nominees">
						<p className="muted small" style={{marginTop: 0}}>
							A separate video for after the presenters announce the winner: the name is revealed, then their (longer) clip plays, and it ends on a
							name card. It is saved as <code>{cat.id}-winner.mp4</code>, so it stays secret until you play it.
						</p>
						{cat.winner ? (
							<PersonCard
								n={cat.winner}
								badge="★"
								onChange={(w) => updateCat((c) => ({...c, winner: w}))}
								actions={
									<button title="Remove winner" className="danger" onClick={() => updateCat((c) => ({...c, winner: undefined}))}>
										✕
									</button>
								}
							/>
						) : (
							<div className="bulk">
								<span className="muted">Pick the winner:</span>
								{cat.nominees.map((n, i) => (
									<button key={i} onClick={() => updateCat((c) => ({...c, winner: {name: n.name, detail: n.detail}}))}>
										{n.name}
									</button>
								))}
								<button onClick={() => updateCat((c) => ({...c, winner: {name: 'Winner name'}}))}>Someone else</button>
							</div>
						)}
					</section>
				)}

				<section className="preview">
					<div className="section-label">Preview</div>
					{tab === 'winner' && !cat.winner ? <div className="preview-wait">Choose the winner to see the preview</div> : <Preview target={previewTarget} />}
					{tab === 'night' ? (
						<>
							<button
								className="primary wide"
								disabled={job?.running}
								onClick={() => render((p) => [nightSel === 'upnext' ? upNextJob(p.categories[index], p.event) : onStageJob(p.categories[index], p.event)])}
							>
								Render {nightSel === 'upnext' ? 'Up next' : 'Award in progress'}
							</button>
							<button className="wide" disabled={job?.running} onClick={() => render((p) => [upNextJob(p.categories[index], p.event), onStageJob(p.categories[index], p.event)])}>
								Render both
							</button>
						</>
					) : tab === 'nominees' ? (
						<button className="primary wide" disabled={job?.running} onClick={() => render((p) => [categoryJob(p.categories[index])])}>
							Render nominees: “{cat.title}”
						</button>
					) : (
						<button className="primary wide" disabled={job?.running || !cat.winner} onClick={() => render((p) => [winnerJob(p.categories[index])])}>
							Render winner: “{cat.title}”
						</button>
					)}
					<RenderPanel job={job} />
				</section>
			</div>
		</>
	);
};

// ---------------------------------------------------------------- app

const App: React.FC = () => {
	const [project, setProject] = useState<Project | null>(null);
	const [view, setView] = useState<'screens' | number>(0);
	const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
	const [job, setJob] = useState<RenderJob | null>(null);
	const latest = useRef<Project | null>(null);
	const first = useRef(true);

	useEffect(() => {
		loadProject().then((p) => setProject(normalize(p)));
		renderStatus().then(setJob).catch(() => {});
	}, []);

	useEffect(() => {
		latest.current = project;
		if (!project) return;
		if (first.current) {
			first.current = false;
			return;
		}
		setSaved('saving');
		const t = setTimeout(() => {
			saveProject(project).then(() => setSaved('saved')).catch(() => setSaved('error'));
		}, 300);
		return () => clearTimeout(t);
	}, [project]);

	useEffect(() => {
		if (!job?.running) return;
		const t = setInterval(() => renderStatus().then(setJob).catch(() => {}), 1000);
		return () => clearInterval(t);
	}, [job?.running]);

	const update = (fn: (p: Project) => Project) => setProject((p) => (p ? fn(p) : p));

	/** Render using the latest project, after any field you were typing in has been committed. */
	const render = async (jobs: (p: Project) => VideoJob[]) => {
		(document.activeElement as HTMLElement | null)?.blur();
		await new Promise((r) => setTimeout(r, 50));
		const p = latest.current;
		if (!p) return;
		try {
			await saveProject(p);
			await startRender(jobs(p));
			setJob(await renderStatus());
		} catch (e) {
			alert(String((e as Error).message));
		}
	};

	if (!project) return <div className="loading">Loading…</div>;
	const cats = project.categories;
	const catIndex = typeof view === 'number' ? Math.min(view, cats.length - 1) : -1;
	const winners = cats.filter((c) => c.winner).length;

	return (
		<div className="app">
			<aside className="sidebar">
				<div className="brand">
					Awards <span>Video</span>
				</div>
				<ul className="cat-list screens-link">
					<li className={view === 'screens' ? 'active' : ''} onClick={() => setView('screens')}>
						<span className="cat-title">LED wall screens</span>
						<span className="cat-count">{project.screens.length}</span>
					</li>
				</ul>
				<div className="section-label">Categories</div>
				<ul className="cat-list">
					{cats.map((c, i) => (
						<li key={i} className={i === catIndex ? 'active' : ''} onClick={() => setView(i)}>
							<span className="cat-title">{c.title || 'Untitled'}</span>
							<span className="cat-count">
								{c.winner ? '★ ' : ''}
								{c.nominees.length}
							</span>
						</li>
					))}
					<li className="add-row">
						<button
							className="add"
							onClick={() => {
								update((p) => ({...p, categories: withIds([...p.categories, {id: '', title: 'New Category', nominees: [{name: 'Nominee One'}]}])}));
								setView(cats.length);
							}}
						>
							+ Add category
						</button>
					</li>
				</ul>
				<div className="sidebar-foot">
					<button
						className="primary"
						disabled={job?.running}
						onClick={() =>
							render((p) => [
								...p.categories.map(categoryJob),
								...p.categories.filter((c) => c.winner).map(winnerJob),
								...p.categories.flatMap((c) => [upNextJob(c, p.event), onStageJob(c, p.event)]),
								...p.screens.map((s, i) => screenJob(s, screenIds(p.screens)[i], p.event)),
							])
						}
					>
						Render everything
					</button>
					<div className="muted small center">
						{plural(cats.length, 'nominee video')}, {plural(winners, 'winner video')}, {plural(cats.length * 2 + project.screens.length, 'screen')}
					</div>
					<div className={`save ${saved}`}>{saved === 'saved' ? 'All changes saved' : saved === 'saving' ? 'Saving…' : 'Could not save. Is the app still running?'}</div>
				</div>
			</aside>

			<main className="main">
				{view === 'screens' ? (
					<ScreensView project={project} update={update} render={render} job={job} />
				) : catIndex >= 0 ? (
					<CategoryView key={catIndex} cat={cats[catIndex]} event={project.event} index={catIndex} count={cats.length} update={update} render={render} select={setView} job={job} />
				) : (
					<div className="empty">Add a category to get started.</div>
				)}
			</main>
		</div>
	);
};

createRoot(document.getElementById('root')!).render(<App />);
