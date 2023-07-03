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
            permalink: "/public/api/masterplan.json"
        };
    }

    render(data) {
        let readingplan = {
            "title": data.masterplan.title,
            "description": data.masterplan.description,
            "start": data.masterplan.start,
            "plan": data.masterplan.plan.map((item, index) => {
                const offset = index
                item.readingdate = getReadingDate(data.masterplan.start, offset)
                item.readinglinks = generateBibleLinks(item.day)
                item.altReadinglinks = generateBibleLinks(item.alt)
                return item
            }),
        }
        return JSON.stringify(readingplan);
    }
}

module.exports = MasterPlan;