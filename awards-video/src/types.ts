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
	kicker?: string;
	nominees: Nominee[];
};

export type CategoryProps = {
	category: Category;
	/** Filled in automatically from each clip's length. */
	nomineeFrames: number[];
};
