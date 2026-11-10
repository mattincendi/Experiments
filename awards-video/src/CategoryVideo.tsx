import React from 'react';
import {AbsoluteFill, interpolate, Series, useCurrentFrame, useVideoConfig} from 'remotion';
import {CategoryIntro} from './CategoryIntro';
import {NomineeClip} from './NomineeClip';
import {FPS, INTRO_SECONDS, NAVY_DEEP, OUTRO_FRAMES} from './theme';
import type {CategoryProps} from './types';

export const CategoryVideo: React.FC<CategoryProps> = ({category, nomineeFrames}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const end = interpolate(frame, [durationInFrames - OUTRO_FRAMES, durationInFrames], [1, 0], {
		extrapolateLeft: 'clamp',
	});
	return (
		<AbsoluteFill style={{background: NAVY_DEEP}}>
			<AbsoluteFill style={{opacity: end}}>
				<Series>
					<Series.Sequence durationInFrames={INTRO_SECONDS * FPS}>
						<CategoryIntro title={category.title} kicker={category.kicker ?? 'The nominees for'} />
					</Series.Sequence>
					{category.nominees.map((n, i) => (
						<Series.Sequence key={i} durationInFrames={nomineeFrames[i]}>
							<NomineeClip nominee={n} />
						</Series.Sequence>
					))}
				</Series>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
