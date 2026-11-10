import {staticFile} from 'remotion';
import {getVideoMetadata} from '@remotion/media-utils';
import {FPS, INTRO_SECONDS, OUTRO_FRAMES, PLACEHOLDER_SECONDS} from './theme';
import type {Category} from './types';

/** Length of each nominee segment in frames, from the clips themselves. */
export const computeNomineeFrames = async (category: Category): Promise<number[]> =>
	Promise.all(
		category.nominees.map(async (n) => {
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
		}),
	);

export const totalFrames = (nomineeFrames: number[]) =>
	INTRO_SECONDS * FPS + nomineeFrames.reduce((a, b) => a + b, 0) + OUTRO_FRAMES;
