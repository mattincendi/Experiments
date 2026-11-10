import React from 'react';
import {AbsoluteFill, Audio, Sequence, Series, staticFile} from 'remotion';
import {Backdrop} from './Backdrop';
import {CategoryIntro} from './CategoryIntro';
import {Transitions} from './FlareTransition';
import {NomineeClip} from './NomineeClip';
import {FPS, INTRO_MUSIC, INTRO_SECONDS, MUSIC_VOLUME, NAVY_DEEP, OUTRO_SECONDS} from './theme';
import type {CategoryProps} from './types';

export const CategoryVideo: React.FC<CategoryProps> = ({category, nomineeFrames}) => {
	const introFrames = INTRO_SECONDS * FPS;

	// Frames where one scene hands over to the next (including into the closing card).
	const cuts = [introFrames];
	for (const f of nomineeFrames) cuts.push(cuts[cuts.length - 1] + f);

	return (
		<AbsoluteFill style={{background: NAVY_DEEP}}>
			<Backdrop />
			<Series>
				<Series.Sequence durationInFrames={introFrames}>
					<CategoryIntro title={category.title} kicker={category.kicker ?? 'The nominees for'} />
				</Series.Sequence>
				{category.nominees.map((n, i) => (
					<Series.Sequence key={i} durationInFrames={nomineeFrames[i]}>
						<NomineeClip nominee={n} />
					</Series.Sequence>
				))}
				<Series.Sequence durationInFrames={OUTRO_SECONDS * FPS}>
					<CategoryIntro title={category.title} kicker={category.outroKicker ?? 'And the award for'} fadeOut={false} />
				</Series.Sequence>
			</Series>
			<Transitions cuts={cuts} />
			{INTRO_MUSIC ? (
				<Sequence durationInFrames={introFrames + FPS}>
					<Audio src={staticFile(INTRO_MUSIC)} volume={MUSIC_VOLUME} />
				</Sequence>
			) : null}
		</AbsoluteFill>
	);
};
