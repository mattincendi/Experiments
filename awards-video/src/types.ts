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
	/** End the nominees video on the award title card (default true). */
	outroCard?: boolean;
};

export type EventInfo = {title: string; subtitle?: string};

export type MinorNominee = {name: string; detail?: string; /** image file in public/clips/ */ photo?: string};
export type MinorAward = {
	id: string;
	title: string;
	kicker?: string;
	nominees: MinorNominee[];
	/** Seconds between each nominee appearing, so the host can read the names. */
	interval?: number;
	/** Index into nominees of the winner, for the winner version. */
	winner?: number;
};
export type RecapItem = {category: string; name: string; detail?: string};

export type Screen =
	| {type: 'title'}
	| {type: 'background'}
	| {type: 'message'; text: string; subtext?: string}
	| {type: 'countdown'; text?: string; minutes: number}
	/** Per-category: short card before presenters walk on. */
	| {type: 'upnext'; category: string; kicker?: string}
	/** Per-category: seamless loop during the award / speech. */
	| {type: 'onstage'; category: string; winner?: {name: string; detail?: string}}
	/** A quieter title: small line above, smaller title. */
	| {type: 'header'; title: string; kicker?: string}
	/** Wi-Fi details, hashtag, etc. Values are shown exactly as typed. */
	| {type: 'info'; title: string; lines: {label: string; value: string}[]}
	/** Cycles through the winners. `items` is filled in from the categories when rendering. */
	| {type: 'recap'; title?: string; items?: RecapItem[]}
	/** A minor award: title and all nominees on one card. */
	| {type: 'minor'; award: MinorAward; showWinner?: boolean};

export type Project = {event: EventInfo; screens: Screen[]; categories: Category[]; minorAwards?: MinorAward[]};

export type CategoryProps = {
	category: Category;
	/** Filled in automatically from each clip's length. */
	nomineeFrames: number[];
};

export type WinnerProps = {category: Category; clipFrames: number};

export type ScreenProps = {screen: Screen; event: EventInfo};
