import {staticFile} from 'remotion';
import {getVideoMetadata} from '@remotion/media-utils';
import {FPS, INTRO_SECONDS, LOOP_FRAMES, OUTRO_SECONDS, PLACEHOLDER_SECONDS, WINNER_END_SECONDS, WINNER_REVEAL_SECONDS} from './theme';
import type {Category, Nominee, Screen} from './types';

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
	s.type === 'countdown' ? Math.max(1, Math.round(s.minutes * 60)) * FPS + 3 * FPS : LOOP_FRAMES;

export const screenLabel = (s: Screen) =>
	s.type === 'title'
		? 'Title screen'
		: s.type === 'background'
			? 'Background only'
			: s.type === 'message'
				? s.text || 'Message'
				: `Countdown ${s.minutes} min`;
