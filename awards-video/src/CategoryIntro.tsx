import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from './Backdrop';
import {GoldText} from './GoldText';
import {FONT, GOLD, GOLD_LIGHT, IVORY} from './theme';

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const GoldLine: React.FC<{progress: number; y: number}> = ({progress, y}) => (
	<div
		style={{
			position: 'absolute',
			top: y,
			left: '50%',
			width: 1100 * progress,
			height: 2,
			transform: 'translateX(-50%)',
			background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD_LIGHT} 50%, ${GOLD} 80%, transparent)`,
			boxShadow: `0 0 12px rgba(243,220,149,0.6)`,
		}}
	/>
);

const Diamond: React.FC<{y: number; o: number}> = ({y, o}) => (
	<div
		style={{
			position: 'absolute',
			top: y - 7,
			left: '50%',
			width: 14,
			height: 14,
			background: GOLD_LIGHT,
			transform: `translateX(-50%) rotate(45deg) scale(${o})`,
			boxShadow: `0 0 16px ${GOLD_LIGHT}`,
			opacity: o,
		}}
	/>
);

export const CategoryIntro: React.FC<{title: string; kicker: string}> = ({title, kicker}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();

	const lines = interpolate(frame, [12, 55], [0, 1], {...clamp, easing: ease});
	const diamonds = interpolate(frame, [45, 65], [0, 1], {...clamp, easing: ease});
	const kickerIn = interpolate(frame, [35, 70], [0, 1], {...clamp, easing: ease});
	const titleIn = interpolate(frame, [50, 95], [0, 1], {...clamp, easing: ease});
	const sweep = interpolate(frame, [95, 150], [-20, 120], clamp);
	const out = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], clamp);
	const drift = interpolate(frame, [0, durationInFrames], [1, 1.04]);

	const size = title.length > 22 ? 88 : title.length > 14 ? 104 : 124;

	return (
		<AbsoluteFill style={{opacity: out}}>
			<Backdrop />
			<AbsoluteFill style={{transform: `scale(${drift})`}}>
				<GoldLine progress={lines} y={395} />
				<GoldLine progress={lines} y={685} />
				<Diamond y={396} o={diamonds} />
				<Diamond y={686} o={diamonds} />
				<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
					<div
						style={{
							fontFamily: FONT,
							fontWeight: 300,
							fontSize: 34,
							letterSpacing: `${0.6 - 0.15 * kickerIn}em`,
							textTransform: 'uppercase',
							color: IVORY,
							opacity: kickerIn * 0.9,
							marginBottom: 34,
							transform: `translateY(${(1 - kickerIn) * 14}px)`,
						}}
					>
						{kicker}
					</div>
					<GoldText
						size={size}
						sweep={sweep}
						tracking={`${0.3 - 0.12 * titleIn}em`}
						style={{
							opacity: titleIn,
							transform: `translateY(${(1 - titleIn) * 24}px)`,
							filter: `blur(${(1 - titleIn) * 8}px) drop-shadow(0 2px 10px rgba(0,0,0,0.55))`,
						}}
					>
						{title}
					</GoldText>
				</AbsoluteFill>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
