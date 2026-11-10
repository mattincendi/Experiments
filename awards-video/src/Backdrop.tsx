import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'remotion';
import {GOLD_LIGHT, NAVY, NAVY_DEEP, NAVY_LIGHT, WIDTH, HEIGHT} from './theme';

const PARTICLES = 70;

/** Deep navy, spotlight glow, vignette, slow gold particles. */
export const Backdrop: React.FC<{glow?: number}> = ({glow = 1}) => {
	const frame = useCurrentFrame();
	const breathe = 0.85 + 0.15 * Math.sin(frame / 45);

	return (
		<AbsoluteFill style={{background: NAVY_DEEP}}>
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse 55% 60% at 50% 42%, ${NAVY_LIGHT} 0%, ${NAVY} 45%, ${NAVY_DEEP} 100%)`,
					opacity: glow * breathe,
				}}
			/>
			{/* Spotlight cone from above */}
			<AbsoluteFill
				style={{
					background:
						'radial-gradient(ellipse 22% 75% at 50% -10%, rgba(243,220,149,0.10) 0%, rgba(243,220,149,0.03) 50%, transparent 75%)',
					opacity: glow,
				}}
			/>
			{new Array(PARTICLES).fill(0).map((_, i) => {
				const speed = 0.25 + random(`s${i}`) * 0.6;
				const y = (random(`y${i}`) * (HEIGHT + 100) - frame * speed) % (HEIGHT + 100);
				const yy = y < -50 ? y + HEIGHT + 100 : y;
				const x = random(`x${i}`) * WIDTH + Math.sin(frame / 60 + i) * 18;
				const size = 1.5 + random(`r${i}`) * 3.5;
				const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(frame / (20 + random(`t${i}`) * 40) + i));
				const opacity = interpolate(frame, [0, 30], [0, 1], {extrapolateRight: 'clamp'}) * twinkle * 0.55;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: yy,
							width: size,
							height: size,
							borderRadius: '50%',
							background: GOLD_LIGHT,
							boxShadow: `0 0 ${size * 3}px ${GOLD_LIGHT}`,
							opacity,
							filter: size > 4 ? 'blur(1px)' : undefined,
						}}
					/>
				);
			})}
			<AbsoluteFill
				style={{background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)'}}
			/>
		</AbsoluteFill>
	);
};
