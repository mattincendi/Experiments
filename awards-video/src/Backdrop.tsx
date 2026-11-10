import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'remotion';
import {GOLD, GOLD_LIGHT, IVORY, NAVY, NAVY_DEEP, NAVY_LIGHT, WIDTH, HEIGHT} from './theme';

/**
 * Layered navy backdrop with parallax depth. Each layer drifts and slowly
 * "dollies" towards the viewer at a speed set by its depth, so near layers
 * move more than far ones.
 */

type LayerSpec = {
	key: string;
	count: number;
	size: [number, number];
	blur: number;
	opacity: [number, number];
	drift: number; // horizontal px per frame
	rise: number; // vertical px per frame
	dolly: number; // scale gain over 10 s
	colors: string[];
};

const LAYERS: LayerSpec[] = [
	// Far: tiny distant lights, like a far-off audience/venue.
	{key: 'far', count: 140, size: [1, 2.6], blur: 0, opacity: [0.15, 0.55], drift: 0.05, rise: 0.04, dolly: 0.015, colors: [GOLD_LIGHT, IVORY, '#9fb8e6']},
	// Mid: soft bokeh.
	{key: 'mid', count: 34, size: [14, 46], blur: 5, opacity: [0.05, 0.16], drift: 0.18, rise: 0.12, dolly: 0.05, colors: [GOLD, GOLD_LIGHT, '#7f9cd6']},
	// Near: big out-of-focus orbs passing close to the "lens".
	{key: 'near', count: 9, size: [140, 300], blur: 22, opacity: [0.04, 0.09], drift: 0.55, rise: 0.25, dolly: 0.12, colors: [GOLD, GOLD_LIGHT]},
];

const wrap = (v: number, min: number, max: number) => {
	const span = max - min;
	return ((((v - min) % span) + span) % span) + min;
};

const Layer: React.FC<{spec: LayerSpec; frame: number; fadeIn: number}> = ({spec, frame, fadeIn}) => {
	const scale = 1 + (spec.dolly * frame) / 300;
	return (
		<AbsoluteFill style={{transform: `scale(${scale})`}}>
			{new Array(spec.count).fill(0).map((_, i) => {
				const r = (n: string) => random(`${spec.key}-${n}-${i}`);
				const size = spec.size[0] + r('size') * (spec.size[1] - spec.size[0]);
				const margin = size + 40;
				const x = wrap(r('x') * WIDTH + frame * spec.drift * (r('dir') > 0.5 ? 1 : -0.6), -margin, WIDTH + margin);
				const y = wrap(r('y') * HEIGHT - frame * spec.rise * (0.5 + r('v')), -margin, HEIGHT + margin);
				const twinkle =
					spec.key === 'far' ? 0.35 + 0.65 * Math.abs(Math.sin(frame / (18 + r('t') * 50) + i)) : 0.8 + 0.2 * Math.sin(frame / 50 + i);
				const opacity = (spec.opacity[0] + r('o') * (spec.opacity[1] - spec.opacity[0])) * twinkle * fadeIn;
				const color = spec.colors[Math.floor(r('c') * spec.colors.length)];
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x - size / 2,
							top: y - size / 2,
							width: size,
							height: size,
							borderRadius: '50%',
							background:
								spec.key === 'far'
									? color
									: `radial-gradient(circle, ${color} 0%, ${color} 55%, transparent 72%)`,
							boxShadow: spec.key === 'far' ? `0 0 ${size * 4}px ${color}` : undefined,
							filter: spec.blur ? `blur(${spec.blur}px)` : undefined,
							opacity,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

/** Slow, soft searchlight beams from above, the classic premiere look, kept subtle. */
const Beams: React.FC<{frame: number; strength: number}> = ({frame, strength}) => (
	<AbsoluteFill style={{overflow: 'hidden', mixBlendMode: 'screen'}}>
		{[
			{x: 22, base: -18, speed: 1 / 140, phase: 0},
			{x: 78, base: 18, speed: 1 / 160, phase: 2},
			{x: 50, base: 0, speed: 1 / 190, phase: 4},
		].map((b, i) => {
			const angle = b.base + Math.sin(frame * b.speed + b.phase) * 9;
			return (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: `${b.x}%`,
						top: -200,
						width: 260,
						height: 1700,
						marginLeft: -130,
						transformOrigin: '50% 0%',
						transform: `rotate(${angle}deg)`,
						background:
							'linear-gradient(180deg, rgba(243,220,149,0.16) 0%, rgba(243,220,149,0.05) 45%, transparent 80%)',
						clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
						filter: 'blur(26px)',
						opacity: strength * 0.6 * (0.7 + 0.3 * Math.sin(frame / 70 + i)),
					}}
				/>
			);
		})}
	</AbsoluteFill>
);

export const Backdrop: React.FC<{glow?: number}> = ({glow = 1}) => {
	const frame = useCurrentFrame();
	const fadeIn = interpolate(frame, [0, 30], [0, 1], {extrapolateRight: 'clamp'});
	const breathe = 0.85 + 0.15 * Math.sin(frame / 45);

	return (
		<AbsoluteFill style={{background: NAVY_DEEP, overflow: 'hidden'}}>
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse 60% 55% at 50% 45%, ${NAVY_LIGHT} 0%, ${NAVY} 45%, ${NAVY_DEEP} 100%)`,
					opacity: glow * breathe,
				}}
			/>
			<Layer spec={LAYERS[0]} frame={frame} fadeIn={fadeIn} />
			{/* Distant horizon haze: suggests a deep stage behind the title */}
			<AbsoluteFill
				style={{
					background:
						'radial-gradient(ellipse 70% 14% at 50% 70%, rgba(201,162,74,0.10) 0%, rgba(201,162,74,0.03) 50%, transparent 100%)',
					opacity: glow,
				}}
			/>
			<Beams frame={frame} strength={glow * fadeIn} />
			<Layer spec={LAYERS[1]} frame={frame} fadeIn={fadeIn} />
			<Layer spec={LAYERS[2]} frame={frame} fadeIn={fadeIn} />
			<AbsoluteFill
				style={{background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 50%, rgba(0,0,0,0.7) 100%)'}}
			/>
		</AbsoluteFill>
	);
};
