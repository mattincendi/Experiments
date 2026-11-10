import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {LensFlare} from './LensFlare';
import {FADE_FRAMES} from './theme';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Between scenes: a gold light streak glides across the navy as one scene hands over to the next. */
const FlareTransition: React.FC<{direction: 1 | -1}> = ({direction}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const p = interpolate(frame, [0, durationInFrames], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const x = direction === 1 ? -200 + p * 2320 : 2120 - p * 2320;
	const intensity = interpolate(frame, [0, durationInFrames * 0.5, durationInFrames], [0, 1, 0], clamp);
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
					transform: `scaleX(${intensity})`,
					opacity: intensity * 0.7,
				}}
			/>
			<LensFlare x={x} y={540} intensity={intensity} width={1600} />
		</AbsoluteFill>
	);
};

/** Places a flare transition centred on each cut frame. */
export const Transitions: React.FC<{cuts: number[]}> = ({cuts}) => (
	<>
		{[...new Set(cuts)].map((c, i) => (
			<Sequence key={c} from={Math.max(0, c - FADE_FRAMES - 4)} durationInFrames={FADE_FRAMES * 2 + 8}>
				<FlareTransition direction={i % 2 === 0 ? 1 : -1} />
			</Sequence>
		))}
	</>
);
