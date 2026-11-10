import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {GoldText} from './GoldText';
import {FONT, GOLD, GOLD_LIGHT, IVORY} from './theme';

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Soft rays of light fanning out behind the name. */
const Rays: React.FC<{o: number; rot: number}> = ({o, rot}) => (
	<div
		style={{
			position: 'absolute',
			left: 960 - 1100,
			top: 560 - 1100,
			width: 2200,
			height: 2200,
			borderRadius: '50%',
			background: `repeating-conic-gradient(from ${rot}deg, rgba(243,220,149,0.16) 0deg 3deg, transparent 3deg 15deg)`,
			WebkitMaskImage: 'radial-gradient(circle, black 0%, rgba(0,0,0,0.6) 25%, transparent 60%)',
			maskImage: 'radial-gradient(circle, black 0%, rgba(0,0,0,0.6) 25%, transparent 60%)',
			opacity: o,
			mixBlendMode: 'screen',
		}}
	/>
);

/** Gold sparks thrown out from the name, slowing and drifting down. */
const Burst: React.FC<{t: number}> = ({t}) => {
	if (t <= 0 || t > 120) return null;
	return (
		<>
			{new Array(90).fill(0).map((_, i) => {
				const r = (k: string) => random(`burst-${k}-${i}`);
				const angle = r('a') * Math.PI * 2;
				const speed = 9 + r('s') * 22;
				const dist = (speed * (1 - Math.exp(-t / 18))) * 18;
				const x = 960 + Math.cos(angle) * dist * 1.6;
				const y = 560 + Math.sin(angle) * dist + t * t * 0.012;
				const size = 2 + r('z') * 5;
				const o = interpolate(t, [0, 6, 50 + r('l') * 60, 120], [0, 1, 0.7, 0], clamp);
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: size,
							height: size,
							borderRadius: '50%',
							background: r('c') > 0.5 ? GOLD_LIGHT : '#fff6dc',
							boxShadow: `0 0 ${size * 3}px ${GOLD_LIGHT}`,
							opacity: o,
						}}
					/>
				);
			})}
		</>
	);
};

/**
 * "Winner" card: category, then the winner's name. With reveal=true the name
 * arrives with light rays and a burst of sparks; otherwise it settles in quietly.
 */
export const WinnerCard: React.FC<{category: string; name: string; detail?: string; reveal: boolean; fadeOut?: boolean}> = ({
	category,
	name,
	detail,
	reveal,
	fadeOut = true,
}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const nameAt = reveal ? 42 : 18;

	const lines = interpolate(frame, [6, 40], [0, 1], {...clamp, easing: ease});
	const kicker = interpolate(frame, [10, 40], [0, 1], {...clamp, easing: ease});
	const nameIn = interpolate(frame, [nameAt, nameAt + 30], [0, 1], {...clamp, easing: ease});
	const detailIn = interpolate(frame, [nameAt + 20, nameAt + 50], [0, 1], {...clamp, easing: ease});
	const sweep = interpolate(frame, [nameAt + 45, nameAt + 100], [-20, 120], clamp);
	const rays = reveal ? interpolate(frame, [nameAt - 4, nameAt + 14, nameAt + 120], [0, 1, 0.35], clamp) : 0.25 * nameIn;
	const flash = reveal ? interpolate(frame, [nameAt - 2, nameAt + 4, nameAt + 30], [0, 0.5, 0], clamp) : 0;
	const out = fadeOut ? interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], clamp) : 1;
	const size = name.length > 22 ? 104 : name.length > 14 ? 124 : 146;

	return (
		<AbsoluteFill style={{opacity: out}}>
			<Rays o={rays} rot={frame * 0.08} />
			<AbsoluteFill style={{background: `radial-gradient(circle at 50% 52%, rgba(255,246,220,${flash}) 0%, transparent 45%)`}} />
			{reveal ? <Burst t={frame - nameAt} /> : null}
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
				<div
					style={{
						fontFamily: FONT,
						fontWeight: 500,
						fontSize: 30,
						letterSpacing: '0.5em',
						textTransform: 'uppercase',
						color: GOLD_LIGHT,
						opacity: kicker,
						marginBottom: 16,
					}}
				>
					Winner
				</div>
				<div
					style={{
						fontFamily: FONT,
						fontWeight: 300,
						fontSize: 34,
						letterSpacing: '0.35em',
						textTransform: 'uppercase',
						color: IVORY,
						opacity: kicker * 0.9,
					}}
				>
					{category}
				</div>
				<div
					style={{
						width: 900 * lines,
						height: 2,
						margin: '40px 0 44px',
						background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD_LIGHT} 50%, ${GOLD} 80%, transparent)`,
						boxShadow: '0 0 12px rgba(243,220,149,0.6)',
					}}
				/>
				<GoldText
					size={size}
					sweep={sweep}
					tracking={`${0.22 - 0.08 * nameIn}em`}
					style={{
						opacity: nameIn,
						transform: `scale(${1.08 - 0.08 * nameIn})`,
						filter: `blur(${(1 - nameIn) * 10}px) drop-shadow(0 2px 14px rgba(0,0,0,0.6))`,
					}}
				>
					{name}
				</GoldText>
				{detail ? (
					<div
						style={{
							fontFamily: FONT,
							fontWeight: 300,
							fontSize: 36,
							letterSpacing: '0.32em',
							textTransform: 'uppercase',
							color: IVORY,
							marginTop: 26,
							opacity: detailIn * 0.92,
						}}
					>
						{detail}
					</div>
				) : null}
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
