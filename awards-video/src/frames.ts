import {staticFile} from 'remotion';
import {getVideoMetadata} from '@remotion/media-utils';
import {FPS, INTRO_SECONDS, MINOR_SECONDS, RECAP_MIN_SECONDS, UP_NEXT_SECONDS, LOOP_FRAMES, OUTRO_SECONDS, PLACEHOLDER_SECONDS, WINNER_END_SECONDS, WINNER_REVEAL_SECONDS} from './theme';
import type {Category, Nominee, Project, RecapItem, Screen} from './types';

/** Length of one clip segment in frames, from the clip itself. */
export const clipFrames = async (n: Nominee): Promise<number> => {
	let seconds = PLACEHOLDER_SECONDS;
	if (n.clip) {
		try {
			const meta = await getVideoMetadata(staticFile(`clips/${n.clip}`));
			seconds = meta.durationInSeconds - (n.startAt ?? 0);
		} catch {
			seconds = PLACEHOLDER_SECONDS;
		}
	}
	if (n.maxSeconds) seconds = Math.min(seconds, n.maxSeconds);
	return Math.max(2 * FPS, Math.floor(seconds * FPS));
};

export const computeNomineeFrames = (category: Category) => Promise.all(category.nominees.map(clipFrames));

export const totalFrames = (nomineeFrames: number[]) =>
	INTRO_SECONDS * FPS + nomineeFrames.reduce((a, b) => a + b, 0) + OUTRO_SECONDS * FPS;

export const winnerTotalFrames = (clip: number) => (WINNER_REVEAL_SECONDS + WINNER_END_SECONDS) * FPS + clip;

export const screenFrames = (s: Screen) =>
	s.type === 'countdown'
		? Math.max(1, Math.round(s.minutes * 60)) * FPS + 3 * FPS
		: s.type === 'upnext'
			? UP_NEXT_SECONDS * FPS
			: s.type === 'minor'
				? MINOR_SECONDS * FPS
				: s.type === 'recap'
					? recapFrames((s.items ?? []).length)
					: LOOP_FRAMES;

/** Recap length: whole multiples of the background loop, so it stays seamless. */
export const recapFrames = (n: number) =>
	Math.max(1, Math.ceil((Math.max(1, n) * RECAP_MIN_SECONDS * FPS) / LOOP_FRAMES)) * LOOP_FRAMES;

/** Loops repeat seamlessly; countdowns and "Up next" play once and hold. */
export const screenLoops = (s: Screen) => s.type !== 'countdown' && s.type !== 'upnext' && s.type !== 'minor';

export const screenLabel = (s: Screen) =>
	s.type === 'title'
		? 'Title screen'
		: s.type === 'background'
			? 'Background only'
			: s.type === 'message'
				? s.text || 'Message'
				: s.type === 'countdown'
					? `Countdown ${s.minutes} min`
					: s.type === 'upnext'
						? `Up next: ${s.category}`
						: s.type === 'onstage'
							? `Award in progress: ${s.category}`
							: s.type === 'header'
								? `Header: ${s.title || 'untitled'}`
								: s.type === 'info'
									? `Info: ${s.title || 'untitled'}`
									: s.type === 'recap'
										? 'Winners recap'
										: `Minor award: ${s.award.title}`;

/** The winners, in category order, for the recap loop. */
export const recapItems = (p: Pick<Project, 'categories'>): RecapItem[] =>
	p.categories.filter((c) => c.winner).map((c) => ({category: c.title, name: c.winner!.name, detail: c.winner!.detail}));

/** Fill in anything a screen takes from the rest of the project. */
export const expandScreen = (s: Screen, p: Pick<Project, 'categories'>): Screen => (s.type === 'recap' ? {...s, items: recapItems(p)} : s);

/** The per-category extra screens. */
export const upNextScreen = (c: Category): Screen => ({type: 'upnext', category: c.title, kicker: c.upNextKicker});
export const onStageScreen = (c: Category): Screen => ({
	type: 'onstage',
	category: c.title,
	winner: c.onStageShowWinner && c.winner ? {name: c.winner.name, detail: c.winner.detail} : undefined,
});
