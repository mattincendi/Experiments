import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {CategoryVideo} from './CategoryVideo';
import {computeNomineeFrames, totalFrames} from './frames';
import {FPS, HEIGHT, WIDTH} from './theme';
import type {Category, CategoryProps} from './types';
import data from '../data/awards.json';

const calculateMetadata: CalculateMetadataFunction<CategoryProps> = async ({props}) => {
	const nomineeFrames = await computeNomineeFrames(props.category);
	return {durationInFrames: totalFrames(nomineeFrames), props: {...props, nomineeFrames}};
};

const categories = data.categories as Category[];

export const RemotionRoot: React.FC = () => (
	<>
		{/* Generic composition the app renders with whatever category it is given. */}
		<Composition
			id="category"
			component={CategoryVideo}
			width={WIDTH}
			height={HEIGHT}
			fps={FPS}
			durationInFrames={1}
			defaultProps={{category: categories[0] ?? {id: 'example', title: 'Example', nominees: []}, nomineeFrames: []}}
			calculateMetadata={calculateMetadata}
		/>
		{/* One per category in data/awards.json, for the Studio and render-all.mjs. */}
		{categories.map((c) => (
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
