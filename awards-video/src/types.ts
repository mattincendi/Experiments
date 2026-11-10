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
	/** Line above the title on the "Up next" card. */
	upNextKicker?: string;
	/** Show the winner's name on the "Award in progress" loop. */
	onStageShowWinner?: boolean;
};

export type EventInfo = {title: string; subtitle?: string};

export type Screen =
	| {type: 'title'}
	| {type: 'background'}
	| {type: 'message'; text: string; subtext?: string}
	| {type: 'countdown'; text?: string; minutes: number}
	/** Per-category: short card before presenters walk on. */
	| {type: 'upnext'; category: string; kicker?: string}
	/** Per-category: seamless loop during the award / speech. */
	| {type: 'onstage'; category: string; winner?: {name: string; detail?: string}};

export type Project = {event: EventInfo; screens: Screen[]; categories: Category[]};

export type CategoryProps = {
	category: Category;
	/** Filled in automatically from each clip's length. */
	nomineeFrames: number[];
};

export type WinnerProps = {category: Category; clipFrames: number};

export type ScreenProps = {screen: Screen; event: EventInfo};
