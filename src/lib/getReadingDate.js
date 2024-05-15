/**
 * 
 * @param {@type string} startdate 
 * @param {@type number} offset 
 * @returns {@type string}
 */
module.exports = function getReadingDate(startdate, offset) {
    if (startdate === "") return ""
    const date = new Date(startdate)
    date.setDate(date.getDate() + offset)
    return date.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
}