import React from 'react';
import {AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {GoldText} from './GoldText';
import {FADE_FRAMES, FONT, GOLD, GOLD_LIGHT, IVORY} from './theme';
import type {Nominee} from './types';

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const INSET = 40;

const Corner: React.FC<{pos: 'tl' | 'tr' | 'bl' | 'br'; o: number}> = ({pos, o}) => {
	const s = 46;
	const top = pos[0] === 't';
	const left = pos[1] === 'l';
	return (
		<div
			style={{
				position: 'absolute',
				[top ? 'top' : 'bottom']: INSET - 10,
				[left ? 'left' : 'right']: INSET - 10,
				width: s,
				height: s,
				[top ? 'borderTop' : 'borderBottom']: `3px solid ${GOLD_LIGHT}`,
				[left ? 'borderLeft' : 'borderRight']: `3px solid ${GOLD_LIGHT}`,
				opacity: o,
				filter: `drop-shadow(0 0 6px rgba(243,220,149,0.6))`,
			}}
		/>
	);
};

const Placeholder: React.FC<{name: string}> = ({name}) => (
	<AbsoluteFill>
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			<div
				style={{
					fontFamily: FONT,
					color: IVORY,
					opacity: 0.35,
					fontSize: 30,
					letterSpacing: '0.4em',
					textTransform: 'uppercase',
					border: `2px dashed ${GOLD}`,
					padding: '60px 90px',
				}}
			>
				Clip for {name}
			</div>
		</AbsoluteFill>
	</AbsoluteFill>
);

/** label: optional small gold line above the name, e.g. "Winner · Best Newcomer". */
export const NomineeClip: React.FC<{nominee: Nominee; label?: string}> = ({nominee, label}) => {
	const frame = useCurrentFrame();
	const {durationInFrames, fps} = useVideoConfig();

	const fade = Math.min(
		interpolate(frame, [0, FADE_FRAMES], [0, 1], clamp),
		interpolate(frame, [durationInFrames - FADE_FRAMES, durationInFrames], [1, 0], clamp),
	);
	// Gentle push: settle in from slightly close, ease away slightly on exit.
	const push = interpolate(frame, [0, FADE_FRAMES * 2, durationInFrames - FADE_FRAMES, durationInFrames], [1.06, 1, 1, 0.97], {
		...clamp,
		easing: ease,
	});
	const frameIn = interpolate(frame, [6, 30], [0, 1], {...clamp, easing: ease});
	const line = interpolate(frame, [14, 40], [0, 1], {...clamp, easing: ease});
	const nameIn = interpolate(frame, [22, 48], [0, 1], {...clamp, easing: ease});
	const detailIn = interpolate(frame, [32, 58], [0, 1], {...clamp, easing: ease});
	const sweep = interpolate(frame, [50, 95], [-20, 120], clamp);
	const lowerOut = interpolate(frame, [durationInFrames - 24, durationInFrames - 8], [1, 0], clamp);

	return (
		<AbsoluteFill style={{opacity: fade, transform: `scale(${push})`}}>
			{nominee.clip ? (
				<OffthreadVideo
					src={staticFile(`clips/${nominee.clip}`)}
					startFrom={Math.round((nominee.startAt ?? 0) * fps)}
					style={{width: '100%', height: '100%', objectFit: 'cover', background: '#000'}}
					volume={(f) => Math.min(1, f / FADE_FRAMES, (durationInFrames - f) / FADE_FRAMES)}
				/>
			) : (
				<Placeholder name={nominee.name} />
			)}
			{/* Vignette + lower gradient for legibility */}
			<AbsoluteFill
				style={{
					background:
						'radial-gradient(ellipse 80% 80% at 50% 45%, transparent 60%, rgba(5,13,31,0.6) 100%), linear-gradient(180deg, transparent 58%, rgba(5,13,31,0.88) 100%)',
				}}
			/>
			{/* Gold frame */}
			<div
				style={{
					position: 'absolute',
					inset: INSET,
					border: `2px solid ${GOLD}`,
					opacity: frameIn * 0.85,
					transform: `scale(${1.02 - 0.02 * frameIn})`,
					boxShadow: 'inset 0 0 30px rgba(0,0,0,0.35)',
				}}
			/>
			{(['tl', 'tr', 'bl', 'br'] as const).map((p) => (
				<Corner key={p} pos={p} o={frameIn} />
			))}
			{/* Lower third */}
			<div style={{position: 'absolute', left: 120, bottom: 120, opacity: lowerOut}}>
				<div
					style={{
						width: 420 * line,
						height: 2,
						marginBottom: 22,
						background: `linear-gradient(90deg, ${GOLD_LIGHT}, ${GOLD} 60%, transparent)`,
						boxShadow: '0 0 10px rgba(243,220,149,0.5)',
					}}
				/>
				{label ? (
					<div
						style={{
							fontFamily: FONT,
							fontWeight: 500,
							fontSize: 26,
							letterSpacing: '0.4em',
							textTransform: 'uppercase',
							color: GOLD_LIGHT,
							marginBottom: 10,
							opacity: nameIn,
							textShadow: '0 2px 8px rgba(0,0,0,0.7)',
						}}
					>
						{label}
					</div>
				) : null}
				<GoldText
					size={nominee.name.length > 24 ? 60 : 76}
					sweep={sweep}
					tracking="0.12em"
					style={{opacity: nameIn, transform: `translateX(${(1 - nameIn) * -30}px)`}}
				>
					{nominee.name}
				</GoldText>
				{nominee.detail ? (
					<div
						style={{
							fontFamily: FONT,
							fontWeight: 300,
							fontSize: 32,
							letterSpacing: '0.32em',
							textTransform: 'uppercase',
							color: IVORY,
							marginTop: 14,
							opacity: detailIn * 0.92,
							transform: `translateX(${(1 - detailIn) * -20}px)`,
							textShadow: '0 2px 8px rgba(0,0,0,0.7)',
						}}
					>
						{nominee.detail}
					</div>
				) : null}
			</div>
		</AbsoluteFill>
	);
};
