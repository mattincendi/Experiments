import React from 'react';
import {GOLD, GOLD_LIGHT} from './theme';

/** Anamorphic (horizontal) lens flare: a bright core, a long streak and faint ghost rings. */
export const LensFlare: React.FC<{x: number; y: number; intensity: number; width?: number}> = ({
	x,
	y,
	intensity,
	width = 1400,
}) => {
	if (intensity <= 0.001) return null;
	const cx = 960;
	return (
		<div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none'}}>
			{/* streak */}
			<div
				style={{
					position: 'absolute',
					left: x - width / 2,
					top: y - 3,
					width,
					height: 6,
					background: `linear-gradient(90deg, transparent, rgba(243,220,149,0.6) 35%, #fffaf0 50%, rgba(243,220,149,0.6) 65%, transparent)`,
					filter: 'blur(2px)',
					opacity: intensity,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: x - width * 0.35,
					top: y - 22,
					width: width * 0.7,
					height: 44,
					background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(243,220,149,0.35), transparent 70%)',
					filter: 'blur(6px)',
					opacity: intensity,
				}}
			/>
			{/* core */}
			<div
				style={{
					position: 'absolute',
					left: x - 90,
					top: y - 90,
					width: 180,
					height: 180,
					borderRadius: '50%',
					background: `radial-gradient(circle, #fffaf0 0%, rgba(243,220,149,0.7) 12%, rgba(201,162,74,0.15) 40%, transparent 70%)`,
					opacity: intensity,
				}}
			/>
			{/* ghosts, mirrored through the frame centre */}
			{[0.45, -0.3, -0.8].map((k, i) => {
				const gx = cx + (cx - x) * k;
				const gy = 540 + (540 - y) * k;
				const s = [60, 110, 36][i];
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: gx - s / 2,
							top: gy - s / 2,
							width: s,
							height: s,
							borderRadius: '50%',
							border: `1px solid ${i === 1 ? GOLD : GOLD_LIGHT}`,
							background: 'radial-gradient(circle, rgba(243,220,149,0.10), transparent 70%)',
							opacity: intensity * 0.18,
						}}
					/>
				);
			})}
		</div>
	);
};
