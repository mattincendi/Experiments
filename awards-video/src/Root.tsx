import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {getVideoMetadata} from '@remotion/media-utils';
import {CategoryVideo} from './CategoryVideo';
import {FPS, HEIGHT, INTRO_SECONDS, OUTRO_FRAMES, PLACEHOLDER_SECONDS, WIDTH} from './theme';
import type {Category, CategoryProps} from './types';
import data from '../data/awards.json';

const calculateMetadata: CalculateMetadataFunction<CategoryProps> = async ({props}) => {
	const nomineeFrames = await Promise.all(
		props.category.nominees.map(async (n) => {
			let seconds = PLACEHOLDER_SECONDS;
			if (n.clip) {
				const meta = await getVideoMetadata(staticFile(`clips/${n.clip}`));
				seconds = meta.durationInSeconds - (n.startAt ?? 0);
			}
			if (n.maxSeconds) seconds = Math.min(seconds, n.maxSeconds);
			return Math.max(2 * FPS, Math.floor(seconds * FPS));
		}),
	);
	const total = INTRO_SECONDS * FPS + nomineeFrames.reduce((a, b) => a + b, 0) + OUTRO_FRAMES;
	return {durationInFrames: total, props: {...props, nomineeFrames}};
};

export const RemotionRoot: React.FC = () => (
	<>
		{(data.categories as Category[]).map((c) => (
			<Composition
				key={c.id}
				id={c.id}
				component={CategoryVideo}
				width={WIDTH}
				height={HEIGHT}
				fps={FPS}
				durationInFrames={1}
				defaultProps={{category: c, nomineeFrames: []}}
				calculateMetadata={calculateMetadata}
			/>
		))}
	</>
);
