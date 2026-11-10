import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop} from './Backdrop';
import {CategoryIntro} from './CategoryIntro';
import {HeaderScreen, InfoScreen, MinorScreen, RecapScreen} from './ExtraScreens';
import {GoldText} from './GoldText';
import {FONT, FPS, GOLD, GOLD_LIGHT, IVORY, LOOP_FRAMES} from './theme';
import type {ScreenProps} from './types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
/** Light sweep every 16 s: three per 48 s loop, so the loop stays seamless. */
const SWEEP_EVERY = LOOP_FRAMES / 3;

const Rule: React.FC<{width: number; glow: number}> = ({width, glow}) => (
	<div style={{position: 'relative', width, height: 14, display: 'grid', placeItems: 'center'}}>
		<div
			style={{
				position: 'absolute',
				inset: '6px 0',
				background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD_LIGHT} 50%, ${GOLD} 80%, transparent)`,
				boxShadow: `0 0 ${8 + 8 * glow}px rgba(243,220,149,${0.4 + 0.3 * glow})`,
			}}
		/>
		<div style={{width: 12, height: 12, background: GOLD_LIGHT, transform: 'rotate(45deg)', boxShadow: `0 0 ${10 + 10 * glow}px ${GOLD_LIGHT}`}} />
	</div>
);

const Small: React.FC<{children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties}> = ({children, size = 34, color = IVORY, style}) => (
	<div style={{fontFamily: FONT, fontWeight: 300, fontSize: size, letterSpacing: '0.45em', textTransform: 'uppercase', color, opacity: 0.9, ...style}}>
		{children}
	</div>
);

/** Centred headline between two gold rules, with a periodic light sweep: loops seamlessly. */
const Headline: React.FC<{title: string; above?: string; below?: string}> = ({title, above, below}) => {
	const frame = useCurrentFrame();
	const local = frame % SWEEP_EVERY;
	const sweep = interpolate(local, [60, 150], [-20, 120], clamp);
	const glow = 0.5 + 0.5 * Math.sin((Math.PI * 2 * frame) / SWEEP_EVERY);
	const size = title.length > 26 ? 92 : title.length > 16 ? 112 : 140;
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0}}>
			{above ? <Small style={{marginBottom: 36}}>{above}</Small> : null}
			<Rule width={1150} glow={glow} />
			<GoldText size={size} sweep={sweep} tracking="0.16em" style={{margin: '46px 0 40px'}}>
				{title}
			</GoldText>
			<Rule width={1150} glow={glow} />
			{below ? <Small style={{marginTop: 40}}>{below}</Small> : null}
		</AbsoluteFill>
	);
};

const Countdown: React.FC<{text?: string; minutes: number; event: string}> = ({text, minutes, event}) => {
	const frame = useCurrentFrame();
	const total = Math.max(1, Math.round(minutes * 60));
	const left = Math.max(0, total - Math.floor(frame / FPS));
	const mm = Math.floor(left / 60);
	const ss = String(left % 60).padStart(2, '0');
	const tick = (frame % FPS) / FPS;
	const pulse = left <= 10 ? 1 + 0.03 * Math.exp(-tick * 6) : 1;
	const sweep = interpolate(frame % SWEEP_EVERY, [60, 150], [-20, 120], clamp);
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
			{event ? <Small size={30} color={GOLD_LIGHT} style={{marginBottom: 70}}>{event}</Small> : null}
			<Small style={{marginBottom: 30}}>{text || 'The ceremony begins in'}</Small>
			<Rule width={900} glow={0.6} />
			<GoldText
				size={230}
				sweep={sweep}
				weight={400}
				tracking="0.06em"
				style={{margin: '30px 0 22px', fontVariantNumeric: 'tabular-nums', transform: `scale(${pulse})`}}
			>
				{mm}:{ss}
			</GoldText>
			<Rule width={900} glow={0.6} />
		</AbsoluteFill>
	);
};

export const ScreenVideo: React.FC<ScreenProps> = ({screen, event}) => {
	const frame = useCurrentFrame();
	// Countdowns end by holding on 0:00; loops have no fades so they repeat seamlessly.
	const textIn = screen.type === 'countdown' ? interpolate(frame, [0, 20], [0, 1], clamp) : 1;
	if (screen.type === 'upnext') {
		return (
			<AbsoluteFill>
				<Backdrop />
				<CategoryIntro title={screen.category} kicker={screen.kicker || 'Up next'} fadeOut={false} />
			</AbsoluteFill>
		);
	}
	if (screen.type === 'minor') {
		return (
			<AbsoluteFill>
				<Backdrop />
				<MinorScreen award={screen.award} />
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill>
			<Backdrop fadeIn={false} glow={screen.type === 'header' ? 0.75 : 1} />
			<AbsoluteFill style={{opacity: textIn}}>
				{screen.type === 'title' ? <Headline title={event.title || 'Awards Night'} below={event.subtitle} /> : null}
				{screen.type === 'message' ? <Headline title={screen.text} below={screen.subtext} above={event.title} /> : null}
				{screen.type === 'onstage' ? (
					screen.winner ? (
						<Headline title={screen.winner.name} above={`Winner · ${screen.category}`} below={screen.winner.detail} />
					) : (
						<Headline title={screen.category} above={event.title} />
					)
				) : null}
				{screen.type === 'header' ? <HeaderScreen title={screen.title} kicker={screen.kicker} /> : null}
				{screen.type === 'info' ? <InfoScreen title={screen.title} lines={screen.lines} event={event.title} /> : null}
				{screen.type === 'recap' ? <RecapScreen title={screen.title} items={screen.items ?? []} /> : null}
				{screen.type === 'countdown' ? <Countdown text={screen.text} minutes={screen.minutes} event={event.title} /> : null}
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
