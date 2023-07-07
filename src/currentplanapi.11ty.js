const generateBibleLinks = require('./lib/generateBibleLinks')

function getReadingDate(startdate, offset) {
    if (startdate === "") return ""
    const date = new Date(startdate)
    date.setDate(date.getDate() + offset)
    return date.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
}



class MasterPlan {
    data() {
        return {
            pagination: {
                data: "collections.currentPlan",
                size: 1,
                alias: "readingplan"
            },
            permalink: "/public/api/current.json"
        };
    }

    render(data) {
        let readingplan = {
            "title": data.readingplan.data.title,
            "description": data.readingplan.data.description,
            "start": data.readingplan.data.start,
            "current": data.readingplan.data.current,
            "plan": data.readingplan.data.plan.map((item, index) => {
                const offset = index
                item.readingdate = getReadingDate(data.readingplan.data.start, offset)
                item.readinglinks = generateBibleLinks(item.day)
                item.altReadinglinks = generateBibleLinks(item.alt)
                item.id = index+1
                return item
            }),
        }
        return JSON.stringify(readingplan);
    }
}

module.exports = MasterPlan;