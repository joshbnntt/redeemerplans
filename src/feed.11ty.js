const {
    ICalCalendar,
    ICalAlarmType,
    ICalCalendarMethod,
} = require('ical-generator')
const getReadingDate = require('./lib/getReadingDate')

module.exports = class FeedTemplate {
    data() {
        return {
            permalink: '/public/feed.ics',
        }
    }

    render({ calendar, collections }) {
        const cal = new ICalCalendar({
            name: calendar.title,
            description: calendar.description,
            prodId: {
                company: calendar.organization,
                product: 'Eleventy',
            },
            url: calendar.url + this.page.url,
            method: ICalCalendarMethod.PUBLISH,
        })

        for (const page of collections.plans) {
            // Create a calendar event from each page
            if (!page.data.start) continue
            let offset = 0
            for (const reading of page.data.plan) {
                const readingdate = getReadingDate(page.data.start, offset)
                offset++
                const event = cal.createEvent({
                    id: `${calendar.url}/plan/${page.fileSlug}#${offset}`,
                    start: readingdate,
                    end: readingdate,
                    summary: reading.day,
                    allDay: true,
                    description: `Reading: ${reading.day}\n${reading.alt ? `Alternate Reading: ${reading.alt}` : ''}
                `,
                })

            }
        }
        return cal.toString()
    }

}