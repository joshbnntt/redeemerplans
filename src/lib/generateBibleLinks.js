const { resolveBook } = require('./scripture');

const TRANSLATIONS = {
    'KJV': 1,
    'ESV': 59,
    'CSB': 1713,
    'NASB': 2692,
    'LSB': 3345,
    'NIV': 111,
    'NKJV': 114,
    'NLT': 116
}


module.exports = function (references, translation = 'ESV') {
    const tcode = TRANSLATIONS[translation] ?? 59
    
    try {
        if (typeof references === 'undefined') return null;
        if (references === 'Grace Day' || references === "Lord's Day") return references;
        let referencesArray = references.split(',').map(reference => reference.trim());
        let links = [];

        for (let i = 0; i < referencesArray.length; i++) {
            let reference = referencesArray[i];
            let parts = reference.split(' ');
            let book = parts.slice(0, -1).join(' '); // Handle book names with multiple words
            let versePart = parts[parts.length - 1];
            let isLast = i+1 === referencesArray.length
            let chapter = '';
            let verse = '';

            if (versePart.includes(':')) {
                let verseParts = versePart.split(':');
                chapter = verseParts[0];
                verse = verseParts[1];
            } else {
                chapter = versePart;
            }

            // Accepts aliases too ("Song of Songs", "Psalms"). Unknown books are reported by
            // `npm run check:plans`; here they are skipped so the build still succeeds.
            let bookInfo = resolveBook(book);
            if (!bookInfo) {
                continue;
            }

            let link = 'https://www.bible.com/bible/' + tcode + '/' + bookInfo.code + '.' + chapter;
            if (verse) {
                link += '.' + verse;
            }
            //link += '.CSB';
            let endAnchorTag = isLast ? '</a>' : ',</a>';
            let anchorTag = '<a class="block underline text-base-content" href="' + link + '" alt="' + reference + '">' + reference + endAnchorTag;
            links.push(anchorTag);
        }

        return links.join(' ');
    } catch (e) {
        console.log(e);
        return references;
    }
}