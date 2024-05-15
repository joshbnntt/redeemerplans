const generateBibleLinks = require('./lib/generateBibleLinks')
const getReadingDate = require('./lib/getReadingDate')

class MasterPlan {
    data() {
        return {
            permalink: "/public/api/masterplan.json"
        };
    }

    render(data) {
        let readingplan = {
            "id": this.slug(data.masterplan.title),
            "title": data.masterplan.title,
            "description": data.masterplan.description,
            "start": data.masterplan.start,
            "plan": data.masterplan.plan.map((item, index) => {
                const offset = index
                item.readingdate = getReadingDate(data.masterplan.start, offset)
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