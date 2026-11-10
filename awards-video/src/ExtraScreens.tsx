import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {GoldText} from './GoldText';
import {FONT, GOLD, GOLD_DARK, GOLD_LIGHT, IVORY, LOOP_FRAMES} from './theme';
import type {MinorAward, RecapItem} from './types';

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const caps = (size: number, extra?: React.CSSProperties): React.CSSProperties => ({
	fontFamily: FONT,
	fontWeight: 300,
	fontSize: size,
	letterSpacing: '0.42em',
	textTransform: 'uppercase',
	color: IVORY,
	...extra,
});

const ShortRule: React.FC<{width?: number}> = ({width = 420}) => (
	<div style={{position: 'relative', width, height: 12, display: 'grid', placeItems: 'center'}}>
		<div style={{position: 'absolute', inset: '5px 0', background: `linear-gradient(90deg, transparent, ${GOLD} 25%, ${GOLD_LIGHT} 50%, ${GOLD} 75%, transparent)`}} />
		<div style={{width: 10, height: 10, background: GOLD_LIGHT, transform: 'rotate(45deg)', boxShadow: `0 0 8px ${GOLD_LIGHT}`}} />
	</div>
);

/** Quieter title for section headers: small line above, smaller title, one gentle sweep per loop. */
export const HeaderScreen: React.FC<{title: string; kicker?: string}> = ({title, kicker}) => {
	const frame = useCurrentFrame();
	const sweep = interpolate(frame % LOOP_FRAMES, [300, 420], [-20, 120], clamp);
	const size = title.length > 30 ? 64 : title.length > 18 ? 78 : 92;
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
			{kicker ? <div style={caps(30, {marginBottom: 30, opacity: 0.85})}>{kicker}</div> : null}
			<GoldText size={size} sweep={sweep} tracking="0.14em" weight={400}>
				{title}
			</GoldText>
			<div style={{marginTop: 34}}>
				<ShortRule />
			</div>
		</AbsoluteFill>
	);
};

/** Wi-Fi details, hashtag, etc. Values keep their exact spelling and case. */
export const InfoScreen: React.FC<{title: string; lines: {label: string; value: string}[]; event?: string}> = ({title, lines, event}) => {
	const frame = useCurrentFrame();
	const sweep = interpolate(frame % LOOP_FRAMES, [300, 420], [-20, 120], clamp);
	const shown = lines.filter((l) => l.label || l.value).slice(0, 4);
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
			{event ? <div style={caps(26, {color: GOLD_LIGHT, marginBottom: 34})}>{event}</div> : null}
			<GoldText size={96} sweep={sweep} tracking="0.16em">
				{title}
			</GoldText>
			<div style={{margin: '34px 0 50px'}}>
				<ShortRule width={620} />
			</div>
			<div style={{display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 48, rowGap: 28, alignItems: 'baseline'}}>
				{shown.map((l, i) => (
					<React.Fragment key={i}>
						<div style={caps(28, {textAlign: 'right', opacity: 0.75})}>{l.label}</div>
						<div style={{fontFamily: FONT, fontWeight: 400, fontSize: 64, letterSpacing: '0.04em', color: '#fff8e6', textShadow: '0 2px 12px rgba(0,0,0,0.6)'}}>
							{l.value}
						</div>
					</React.Fragment>
				))}
			</div>
		</AbsoluteFill>
	);
};

/** Cycles through the winners. Each one fades in and out within its slot, so the whole loop is seamless. */
export const RecapScreen: React.FC<{title?: string; items: RecapItem[]}> = ({title, items}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	if (!items.length) {
		return (
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
				<div style={caps(30, {opacity: 0.5})}>Set winners on each category’s Winner video tab</div>
			</AbsoluteFill>
		);
	}
	const slot = durationInFrames / items.length;
	const i = Math.min(items.length - 1, Math.floor(frame / slot));
	const t = frame - i * slot;
	const it = items[i];
	const fade = Math.min(interpolate(t, [0, 24], [0, 1], clamp), interpolate(t, [slot - 24, slot], [1, 0], clamp));
	const rise = interpolate(t, [0, 40], [16, 0], {...clamp, easing: ease});
	const sweep = interpolate(t, [40, 110], [-20, 120], clamp);
	const size = it.name.length > 22 ? 96 : it.name.length > 14 ? 116 : 132;
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
			<div style={{position: 'absolute', top: 120, ...caps(28, {color: GOLD_LIGHT})}}>{title || 'Tonight’s winners'}</div>
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: fade, transform: `translateY(${rise}px)`}}>
				<div style={caps(34, {marginBottom: 30})}>{it.category}</div>
				<ShortRule width={760} />
				<GoldText size={size} sweep={sweep} tracking="0.12em" style={{margin: '40px 0 26px'}}>
					{it.name}
				</GoldText>
				{it.detail ? <div style={caps(32, {opacity: 0.85})}>{it.detail}</div> : null}
			</AbsoluteFill>
			<div style={{position: 'absolute', bottom: 110, display: 'flex', gap: 14}}>
				{items.map((_, j) => (
					<div key={j} style={{width: 9, height: 9, transform: 'rotate(45deg)', background: j === i ? GOLD_LIGHT : 'rgba(201,162,74,0.5)'}} />
				))}
			</div>
		</AbsoluteFill>
	);
};

const initials = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]!.toUpperCase())
		.join('');

/** Minor award: title, then every nominee on one card. Photos are optional. */
export const MinorScreen: React.FC<{award: MinorAward}> = ({award}) => {
	const frame = useCurrentFrame();
	const nominees = award.nominees.slice(0, 8);
	const withPhotos = nominees.some((n) => n.photo);
	const lines = interpolate(frame, [8, 40], [0, 1], {...clamp, easing: ease});
	const kick = interpolate(frame, [12, 40], [0, 1], {...clamp, easing: ease});
	const titleIn = interpolate(frame, [22, 55], [0, 1], {...clamp, easing: ease});
	const sweep = interpolate(frame, [60, 120], [-20, 120], clamp);
	const rows = nominees.length > 4 ? 2 : 1;
	const perRow = Math.ceil(nominees.length / rows);
	const photo = withPhotos ? (rows === 2 ? 170 : 230) : 0;
	const nameSize = withPhotos ? (rows === 2 ? 34 : 40) : rows === 2 ? 54 : 62;
	const titleSize = award.title.length > 24 ? 72 : 88;

	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
			<div style={caps(28, {opacity: kick * 0.9, marginBottom: 22})}>{award.kicker || 'The nominees for'}</div>
			<GoldText size={titleSize} sweep={sweep} tracking={`${0.2 - 0.06 * titleIn}em`} style={{opacity: titleIn, transform: `translateY(${(1 - titleIn) * 16}px)`}}>
				{award.title}
			</GoldText>
			<div style={{width: 1000 * lines, height: 2, margin: `30px 0 ${withPhotos ? 50 : 70}px`, background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD_LIGHT} 50%, ${GOLD} 80%, transparent)`}} />
			<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: withPhotos ? 40 : 54}}>
				{[nominees.slice(0, perRow), nominees.slice(perRow)].filter((r) => r.length).map((row, r) => (
				<div key={r} style={{display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: withPhotos ? 70 : 100}}>
				{row.map((n, k) => {
					const i = r * perRow + k;
					const at = 60 + i * 12;
					const o = interpolate(frame, [at, at + 24], [0, 1], {...clamp, easing: ease});
					return (
						<div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: o, transform: `translateY(${(1 - o) * 20}px)`, maxWidth: withPhotos ? photo + 200 : 560}}>
							{withPhotos ? (
								<div
									style={{
										width: photo,
										height: photo,
										borderRadius: '50%',
										padding: 4,
										background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD} 40%, ${GOLD_DARK})`,
										boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
										marginBottom: 22,
									}}
								>
									{n.photo ? (
										<Img src={staticFile(`clips/${n.photo}`)} style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block'}} />
									) : (
										<div style={{width: '100%', height: '100%', borderRadius: '50%', background: '#0b1a33', display: 'grid', placeItems: 'center'}}>
											<GoldText size={photo * 0.32} sweep={-20} tracking="0.06em">
												{initials(n.name)}
											</GoldText>
										</div>
									)}
								</div>
							) : null}
							<GoldText size={nameSize} sweep={-20} tracking="0.1em" style={{whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.15}}>
								{n.name}
							</GoldText>
							{n.detail ? <div style={caps(withPhotos ? 22 : 26, {marginTop: 10, opacity: 0.85, letterSpacing: '0.3em', textAlign: 'center'})}>{n.detail}</div> : null}
						</div>
					);
				})}
				</div>
				))}
			</div>
		</AbsoluteFill>
	);
};
