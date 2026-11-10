export type Nominee = {
	name: string;
	/** Optional second line, e.g. a film, role or team. */
	detail?: string;
	/** File name inside public/clips/. Leave empty for a placeholder. */
	clip?: string;
	/** Optional: play only part of the clip (seconds). */
	startAt?: number;
	maxSeconds?: number;
};

export type Category = {
	id: string;
	title: string;
	/** Line above the title on the intro. */
	kicker?: string;
	/** Line above the title on the closing card. */
	outroKicker?: string;
	nominees: Nominee[];
	/** The winner's video, rendered as a separate file. */
	winner?: Nominee;
};

export type EventInfo = {title: string; subtitle?: string};

export type Screen =
	| {type: 'title'}
	| {type: 'background'}
	| {type: 'message'; text: string; subtext?: string}
	| {type: 'countdown'; text?: string; minutes: number};

export type Project = {event: EventInfo; screens: Screen[]; categories: Category[]};

export type CategoryProps = {
	category: Category;
	/** Filled in automatically from each clip's length. */
	nomineeFrames: number[];
};

export type WinnerProps = {category: Category; clipFrames: number};

export type ScreenProps = {screen: Screen; event: EventInfo};
