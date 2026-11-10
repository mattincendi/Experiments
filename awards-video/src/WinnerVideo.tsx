import React from 'react';
import {AbsoluteFill, Audio, Series, staticFile} from 'remotion';
import {Backdrop} from './Backdrop';
import {Transitions} from './FlareTransition';
import {NomineeClip} from './NomineeClip';
import {FPS, MUSIC_VOLUME, NAVY_DEEP, WINNER_END_SECONDS, WINNER_MUSIC, WINNER_REVEAL_SECONDS} from './theme';
import type {WinnerProps} from './types';
import {WinnerCard} from './WinnerCard';

export const WinnerVideo: React.FC<WinnerProps> = ({category, clipFrames}) => {
	const w = category.winner ?? {name: 'Winner name'};
	const reveal = WINNER_REVEAL_SECONDS * FPS;
	return (
		<AbsoluteFill style={{background: NAVY_DEEP}}>
			<Backdrop />
			<Series>
				<Series.Sequence durationInFrames={reveal}>
					<WinnerCard category={category.title} name={w.name} detail={w.detail} reveal />
				</Series.Sequence>
				<Series.Sequence durationInFrames={clipFrames}>
					<NomineeClip nominee={w} label={`Winner · ${category.title}`} />
				</Series.Sequence>
				<Series.Sequence durationInFrames={WINNER_END_SECONDS * FPS}>
					<WinnerCard category={category.title} name={w.name} detail={w.detail} reveal={false} fadeOut={false} />
				</Series.Sequence>
			</Series>
			<Transitions cuts={[reveal, reveal + clipFrames]} />
			{WINNER_MUSIC ? <Audio src={staticFile(WINNER_MUSIC)} volume={MUSIC_VOLUME} /> : null}
		</AbsoluteFill>
	);
};
