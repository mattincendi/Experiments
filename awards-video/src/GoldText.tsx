import React from 'react';
import {FONT, goldGradient} from './theme';

/** Metallic gold text with a light sweep; sweep runs from -20 (off left) to 120 (off right). */
export const GoldText: React.FC<{
	children: React.ReactNode;
	size: number;
	sweep: number;
	weight?: number;
	tracking?: string;
	style?: React.CSSProperties;
}> = ({children, size, sweep, weight = 500, tracking = '0.18em', style}) => (
	<div
		style={{
			fontFamily: FONT,
			fontSize: size,
			fontWeight: weight,
			letterSpacing: tracking,
			textTransform: 'uppercase',
			backgroundImage: goldGradient(sweep),
			backgroundBlendMode: 'screen',
			WebkitBackgroundClip: 'text',
			backgroundClip: 'text',
			color: 'transparent',
			filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.55))',
			whiteSpace: 'nowrap',
			...style,
		}}
	>
		{children}
	</div>
);
