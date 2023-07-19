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
            eleventyImport: {
                collections: ['plans']
            },
            permalink: function(data) {
                return `/public/api/plans.json`;
            }
        };
    }

    render(data) {
        let plans = []
        data.collections.plans.map(p => {

        
        let readingplan = {
            "title": p.data.title,
            "description": p.data.description,
            "start": p.data.start,
            "current": p.data.current,
            "plan": p.data.plan.map((item, index) => {
                const offset = index
                item.readingdate = getReadingDate(p.data.start, offset)
                item.readinglinks = generateBibleLinks(item.day)
                item.altReadinglinks = generateBibleLinks(item.alt)
                item.id = index+1
                return item
            }),
        }
        plans.push(readingplan)
    })
        return JSON.stringify(plans);
    }
}

module.exports = MasterPlan;