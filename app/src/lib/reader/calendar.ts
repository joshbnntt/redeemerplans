/**
 * Links for subscribing to the all-plans calendar feed (/feed.ics).
 *
 * iPhone, Mac and Outlook open webcal:// links in their calendar app. Android has no app that
 * opens webcal:// links (Google Calendar doesn't), so tapping one does nothing there; Android
 * readers get Google Calendar's "add calendar by URL" page instead.
 */
export function feedLinks(host: string, userAgent: string) {
	const webcal = `webcal://${host}/feed.ics`;
	const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
	const android = /android/i.test(userAgent);
	return { webcal, google, android, primary: android ? google : webcal };
}
