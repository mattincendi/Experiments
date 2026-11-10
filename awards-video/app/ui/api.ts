import type {Project} from '../../src/types';

export type {Project};
export type VideoJob = {file: string; title: string; composition: 'category' | 'winner' | 'screen'; inputProps: Record<string, unknown>};
export type RenderItem = {id: string; title: string; status: 'queued' | 'rendering' | 'done' | 'error'; progress: number; file: string | null; error: string | null};
export type RenderJob = {running: boolean; items: RenderItem[]; message: string};

const json = async <T,>(r: Response): Promise<T> => {
	if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
	return r.json();
};

export const loadProject = () => fetch('/api/project').then((r) => json<Project>(r));
export const saveProject = (p: Project) =>
	fetch('/api/project', {method: 'PUT', body: JSON.stringify(p)}).then((r) => json<{ok: true}>(r));
export const startRender = (videos: VideoJob[]) =>
	fetch('/api/render', {method: 'POST', body: JSON.stringify({videos})}).then((r) => json<{ok: true}>(r));
export const renderStatus = () => fetch('/api/render').then((r) => json<RenderJob>(r));
export const openOutput = () => fetch('/api/open-output', {method: 'POST'});

/** Upload a clip; resolves to the stored file name. */
export const uploadClip = (file: File, onProgress: (p: number) => void) =>
	new Promise<string>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', `/api/upload?name=${encodeURIComponent(file.name)}`);
		xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
		xhr.onload = () => (xhr.status === 200 ? resolve(JSON.parse(xhr.responseText).file) : reject(new Error(xhr.statusText)));
		xhr.onerror = () => reject(new Error('Upload failed'));
		xhr.send(file);
	});
