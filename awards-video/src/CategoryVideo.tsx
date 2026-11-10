import React from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from './Backdrop';
import {CategoryIntro} from './CategoryIntro';
import {LensFlare} from './LensFlare';
import {NomineeClip} from './NomineeClip';
import {FADE_FRAMES, FPS, INTRO_MUSIC, INTRO_MUSIC_VOLUME, INTRO_SECONDS, NAVY_DEEP, OUTRO_FRAMES} from './theme';
import type {CategoryProps} from './types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Between scenes: a gold light streak glides across the navy as one clip hands over to the next. */
const FlareTransition: React.FC<{direction: 1 | -1}> = ({direction}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const p = interpolate(frame, [0, durationInFrames], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const x = direction === 1 ? -200 + p * 2320 : 2120 - p * 2320;
	const intensity = interpolate(frame, [0, durationInFrames * 0.5, durationInFrames], [0, 1, 0], clamp);
	const line = interpolate(frame, [0, durationInFrames * 0.5, durationInFrames], [0, 1, 0], clamp);
	return (
		<AbsoluteFill>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: 539,
					height: 2,
					background: 'linear-gradient(90deg, transparent, rgba(243,220,149,0.55) 30%, rgba(243,220,149,0.55) 70%, transparent)',
					transform: `scaleX(${line})`,
					opacity: line * 0.7,
				}}
			/>
			<LensFlare x={x} y={540} intensity={intensity} width={1600} />
		</AbsoluteFill>
	);
};

export const CategoryVideo: React.FC<CategoryProps> = ({category, nomineeFrames}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const end = interpolate(frame, [durationInFrames - OUTRO_FRAMES, durationInFrames], [1, 0], clamp);
	const introFrames = INTRO_SECONDS * FPS;

	// Frames where one scene hands over to the next.
	const cuts: number[] = [];
	let t = introFrames;
	for (const f of nomineeFrames.slice(0, -1)) {
		cuts.push(t);
		t += f;
	}
	if (nomineeFrames.length) cuts.unshift(introFrames);
	const uniqueCuts = [...new Set(cuts)];

	return (
		<AbsoluteFill style={{background: NAVY_DEEP}}>
			<AbsoluteFill style={{opacity: end}}>
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
				</Series>
				{uniqueCuts.map((c, i) => (
					<Sequence key={c} from={c - FADE_FRAMES - 4} durationInFrames={FADE_FRAMES * 2 + 8}>
						<FlareTransition direction={i % 2 === 0 ? 1 : -1} />
					</Sequence>
				))}
			</AbsoluteFill>
			{INTRO_MUSIC ? (
				<Sequence durationInFrames={introFrames + FPS}>
					<Audio src={staticFile(INTRO_MUSIC)} volume={INTRO_MUSIC_VOLUME} />
				</Sequence>
			) : null}
		</AbsoluteFill>
	);
};
