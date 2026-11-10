import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {CategoryVideo} from './CategoryVideo';
import {clipFrames, computeNomineeFrames, screenFrames, totalFrames, winnerTotalFrames} from './frames';
import {ScreenVideo} from './ScreenVideo';
import {FPS, HEIGHT, WIDTH} from './theme';
import type {Category, CategoryProps, EventInfo, ScreenProps, WinnerProps} from './types';
import {WinnerVideo} from './WinnerVideo';
import data from '../data/awards.json';

const categoryMeta: CalculateMetadataFunction<CategoryProps> = async ({props}) => {
	const nomineeFrames = await computeNomineeFrames(props.category);
	return {durationInFrames: totalFrames(nomineeFrames), props: {...props, nomineeFrames}};
};
const winnerMeta: CalculateMetadataFunction<WinnerProps> = async ({props}) => {
	const f = await clipFrames(props.category.winner ?? {name: ''});
	return {durationInFrames: winnerTotalFrames(f), props: {...props, clipFrames: f}};
};
const screenMeta: CalculateMetadataFunction<ScreenProps> = async ({props}) => ({durationInFrames: screenFrames(props.screen)});

const categories = (data.categories ?? []) as Category[];
const event = ((data as {event?: EventInfo}).event ?? {title: 'Awards Night'}) as EventInfo;
const example: Category = categories[0] ?? {id: 'example', title: 'Example', nominees: []};
const base = {width: WIDTH, height: HEIGHT, fps: FPS, durationInFrames: 1};

export const RemotionRoot: React.FC = () => (
	<>
		{/* Generic compositions the app renders with whatever props it is given. */}
		<Composition id="category" component={CategoryVideo} {...base} defaultProps={{category: example, nomineeFrames: []}} calculateMetadata={categoryMeta} />
		<Composition id="winner" component={WinnerVideo} {...base} defaultProps={{category: example, clipFrames: 1}} calculateMetadata={winnerMeta} />
		<Composition id="screen" component={ScreenVideo} {...base} defaultProps={{screen: {type: 'title'}, event}} calculateMetadata={screenMeta} />
		{/* One per category in data/awards.json, for the Studio and render-all.mjs. */}
		{categories.map((c) => (
			<Composition key={c.id} id={c.id} component={CategoryVideo} {...base} defaultProps={{category: c, nomineeFrames: []}} calculateMetadata={categoryMeta} />
		))}
	</>
);
