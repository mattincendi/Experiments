import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'remotion';
import {HEIGHT, LOOP_FRAMES, NAVY, NAVY_DEEP, NAVY_LIGHT, WIDTH} from './theme';

/**
 * A volume of space the scene floats in. Every particle has a real 3D
 * position and is projected through a camera that drifts slowly forward
 * and sways. Near particles move faster, grow and go out of focus (bokeh),
 * far ones shrink and dissolve into navy haze.
 */

const FOCAL = 950; // px: perspective strength
const NEAR = 0.35;
const FAR = 9;
const FOCUS = 2.6; // depth that is pin-sharp
const APERTURE = 26; // how quickly things blur away from FOCUS
// The camera travels exactly one depth span per loop, and every sway and
// twinkle completes whole cycles, so frame LOOP_FRAMES looks like frame 0.
const SPEED = (FAR - NEAR) / LOOP_FRAMES; // world units / frame
const TAU = Math.PI * 2;
const cyc = (frame: number, cycles: number) => (TAU * cycles * frame) / LOOP_FRAMES;

type P = {x: number; y: number; z: number; size: number; rgb: string; a: number; tw: number; tc: number};

const COLORS = ['243,220,149', '255,244,214', '201,162,74', '170,195,240'];

const PARTICLES: P[] = new Array(1100).fill(0).map((_, i) => {
	const r = (k: string) => random(`p-${k}-${i}`);
	return {
		x: (r('x') * 2 - 1) * 4.2,
		y: (r('y') * 2 - 1) * 2.6,
		z: NEAR + r('z') * (FAR - NEAR),
		size: 0.008 + r('s') ** 3 * 0.035,
		rgb: COLORS[r('c') < 0.45 ? 0 : r('c') < 0.7 ? 1 : r('c') < 0.88 ? 2 : 3],
		a: 0.45 + r('a') * 0.55,
		tw: r('t') * TAU,
		tc: 20 + Math.floor(r('tc') * 40), // twinkle cycles per loop
	};
});

// Large, very faint haze volumes at depth: give the space air.
const HAZE = new Array(7).fill(0).map((_, i) => {
	const r = (k: string) => random(`h-${k}-${i}`);
	return {x: (r('x') * 2 - 1) * 3, y: (r('y') * 2 - 1) * 1.6, z: 2 + r('z') * 6, size: 1.6 + r('s') * 1.6, blue: r('b') > 0.4};
});

const wrapZ = (z: number) => {
	const span = FAR - NEAR;
	return ((((z - NEAR) % span) + span) % span) + NEAR;
};

const draw = (ctx: CanvasRenderingContext2D, frame: number, fade: number) => {
	ctx.clearRect(0, 0, WIDTH, HEIGHT);
	const camZ = frame * SPEED;
	const camX = Math.sin(cyc(frame, 1)) * 0.35;
	const camY = Math.sin(cyc(frame, 2) + 1) * 0.16;
	const cx = WIDTH / 2;
	const cy = HEIGHT / 2;

	ctx.globalCompositeOperation = 'lighter';

	for (const h of HAZE) {
		const z = wrapZ(h.z - camZ);
		const sx = cx + ((h.x - camX) / z) * FOCAL;
		const sy = cy + ((h.y - camY) / z) * FOCAL;
		const rad = (h.size / z) * FOCAL;
		const edge = Math.min(1, (z - NEAR) / 1.2, (FAR - z) / 1.5);
		const alpha = 0.08 * Math.max(0, edge) * fade;
		const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
		g.addColorStop(0, h.blue ? `rgba(70,105,175,${alpha})` : `rgba(201,162,74,${alpha * 0.6})`);
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
	}

	// Far to near so close bokeh sits on top.
	const items = PARTICLES.map((p) => ({p, z: wrapZ(p.z - camZ)})).sort((a, b) => b.z - a.z);
	for (const {p, z} of items) {
		const sx = cx + ((p.x - camX) / z) * FOCAL;
		const sy = cy + ((p.y - camY) / z) * FOCAL;
		const core = Math.max(0.6, (p.size / z) * FOCAL * 0.5);
		const coc = Math.abs(1 / z - 1 / FOCUS) * APERTURE; // circle of confusion
		const rad = Math.max(core, coc + core * 0.4);
		if (sx < -rad || sx > WIDTH + rad || sy < -rad || sy > HEIGHT + rad) continue;

		const fog = Math.exp(-(z - NEAR) / 6);
		const edge = Math.max(0, Math.min(1, (z - NEAR) / 0.4, (FAR - z) / 1.2));
		const spread = Math.min(1, (core / rad) ** 2 * 2.2 + 0.09);
		const twinkle = 0.75 + 0.25 * Math.sin(cyc(frame, p.tc) + p.tw);
		const alpha = p.a * fog * edge * spread * twinkle * fade;
		if (alpha < 0.004) continue;

		const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad * (coc > core ? 1 : 2.4));
		if (coc > core) {
			// out of focus: flat disc with a soft rim, like real bokeh
			g.addColorStop(0, `rgba(${p.rgb},${alpha * 0.7})`);
			g.addColorStop(0.8, `rgba(${p.rgb},${alpha})`);
			g.addColorStop(1, `rgba(${p.rgb},0)`);
		} else {
			g.addColorStop(0, `rgba(${p.rgb},${alpha})`);
			g.addColorStop(0.25, `rgba(${p.rgb},${alpha * 0.5})`);
			g.addColorStop(1, `rgba(${p.rgb},0)`);
		}
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(sx, sy, rad * (coc > core ? 1 : 2.4), 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalCompositeOperation = 'source-over';
};

/** fadeIn: fade up from black at the start (off for seamless loops). */
export const Backdrop: React.FC<{glow?: number; fadeIn?: boolean}> = ({glow = 1, fadeIn = true}) => {
	const frame = useCurrentFrame();
	const ref = useRef<HTMLCanvasElement>(null);
	const fade = fadeIn ? interpolate(frame, [0, 30], [0, 1], {extrapolateRight: 'clamp'}) : 1;

	useLayoutEffect(() => {
		const ctx = ref.current?.getContext('2d');
		if (ctx) draw(ctx, frame, fade);
	}, [frame, fade]);

	return (
		<AbsoluteFill style={{background: NAVY_DEEP, overflow: 'hidden'}}>
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse 60% 55% at 50% 45%, ${NAVY_LIGHT} 0%, ${NAVY} 45%, ${NAVY_DEEP} 100%)`,
					opacity: glow * (0.88 + 0.12 * Math.sin(cyc(frame, 5))),
				}}
			/>
			<canvas ref={ref} width={WIDTH} height={HEIGHT} style={{position: 'absolute', inset: 0}} />
			<AbsoluteFill
				style={{background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 50%, rgba(0,0,0,0.7) 100%)'}}
			/>
		</AbsoluteFill>
	);
};
