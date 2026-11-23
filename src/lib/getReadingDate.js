const { planDayDate, formatUS } = require('./planDate');

/**
 * @param {string} startdate plan start date ("MM-DD-YYYY" or "YYYY-MM-DD")
 * @param {number} offset zero-based day index
 * @returns {string} "MM/DD/YYYY", or "" when the plan has no start date
 */
module.exports = function getReadingDate(startdate, offset) {
    const date = planDayDate(startdate, offset)
    return date ? formatUS(date) : ""
}
