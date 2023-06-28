import '../css/index.css';
import 'alpine-turbo-drive-adapter'
import Alpine from 'alpinejs'

window.Alpine = Alpine

// Add Alpine extensions here

console.log('hello from index.js')

import * as Turbo from "@hotwired/turbo"
window.bookAbbreviations = {
    'Genesis': 'gen',
    'Exodus': 'exo',
    'Leviticus': 'lev',
    'Numbers': 'num',
    'Deuteronomy': 'deu',
    'Joshua': 'jos',
    'Judges': 'jdg',
    'Ruth': 'rut',
    '1 Samuel': '1sa',
    '2 Samuel': '2sa',
    '1 Kings': '1ki',
    '2 Kings': '2ki',
    '1 Chronicles': '1ch',
    '2 Chronicles': '2ch',
    'Ezra': 'ezr',
    'Nehemiah': 'neh',
    'Esther': 'est',
    'Job': 'job',
    'Psalm': 'psa',
    'Proverbs': 'pro',
    'Ecclesiastes': 'ecc',
    'Song of Solomon': 'sng',
    'Isaiah': 'isa',
    'Jeremiah': 'jer',
    'Lamentations': 'lam',
    'Ezekiel': 'ezk',
    'Daniel': 'dan',
    'Hosea': 'hos',
    'Joel': 'jol',
    'Amos': 'amo',
    'Obadiah': 'oba',
    'Jonah': 'jon',
    'Micah': 'mic',
    'Nahum': 'nam',
    'Habakkuk': 'hab',
    'Zephaniah': 'zep',
    'Haggai': 'hag',
    'Zechariah': 'zec',
    'Malachi': 'mal',
    'Matthew': 'mat',
    'Mark': 'mrk',
    'Luke': 'luk',
    'John': 'jhn',
    'Acts': 'act',
    'Romans': 'rom',
    '1 Corinthians': '1co',
    '2 Corinthians': '2co',
    'Galatians': 'gal',
    'Ephesians': 'eph',
    'Philippians': 'php',
    'Colossians': 'col',
    '1 Thessalonians': '1th',
    '2 Thessalonians': '2th',
    '1 Timothy': '1ti',
    '2 Timothy': '2ti',
    'Titus': 'tit',
    'Philemon': 'phm',
    'Hebrews': 'heb',
    'James': 'jas',
    '1 Peter': '1pe',
    '2 Peter': '2pe',
    '1 John': '1jn',
    '2 John': '2jn',
    '3 John': '3jn',
    'Jude': 'jud',
    'Revelation': 'rev'
}
document.addEventListener('alpine:init', () => {
    console.log("alpine:init")
    Alpine.data('thisweek', () => ({
        isLoading: true,
        error: null,
        readings: null,
        title: null,
        description: null,
        currentWeek: '',
        currentWeekEnd: '',
        get books() {
            return window.bookAbbreviations;
        },
        generateYouVersionLinks(references) {
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

                    let chapter = '';
                    let verse = '';

                    if (versePart.includes(':')) {
                        let verseParts = versePart.split(':');
                        chapter = verseParts[0];
                        verse = verseParts[1];
                    } else {
                        chapter = versePart;
                    }

                    let bookAbbreviation = this.books[book];
                    if (!bookAbbreviation) {
                        continue; // Skip the reference if the book abbreviation is not found
                    }

                    let link = 'https://www.bible.com/bible/1713/' + bookAbbreviation.toUpperCase() + '.' + chapter;
                    if (verse) {
                        link += '.' + verse;
                    }
                    link += '.CSB';

                    let anchorTag = '<a href="' + link + '" alt="' + reference + '">' + reference + '</a>';
                    links.push(anchorTag);
                }

                return links.join(', ');
            } catch (e) {
                console.log(e);
                return references;
            }

        },
        getWeekStart() {
            const today = new Date();
            const start = today.getDate() - today.getDay();
            const weekStart = new Date(today.setDate(start));
            return weekStart.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        },
        getWeekEnd() {
            const weekStart = new Date(this.getWeekStart());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6); // Assuming a week ends on the 7th day 

            return weekEnd.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        },
        fetchReadings() {
            fetch('/api/masterplan.json')
                .then(response => response.json())
                .then(data => {
                    this.title = data.title;
                    this.description = data.description;

                    this.currentWeek = this.getWeekStart();
                    this.currentWeekEnd = this.getWeekEnd();
                    this.readings = data.plan.filter(reading => reading.readingdate !== '' && reading.readingdate >= this.currentWeek && reading.readingdate <= this.currentWeekEnd);
                    this.isLoading = false;
                })
                .catch(e => {
                    this.isLoading = false;
                    console.error('Error:', e);
                    this.error = e.message;
                });
        },

        formatDate(date) {
            const options = { month: '2-digit', day: '2-digit' };
            return new Date(date).toLocaleDateString('en-US', options);
        },

        getDayOfWeek(date) {
            const options = { weekday: 'long' };
            return new Date(date).toLocaleDateString('en-US', options);
        },
        getMonthShort(date) {
            const options = { month: "short" };
            return new Date(date).toLocaleDateString('en-US', options);
        },
        getDayTwoDigits(date) {
            const options = { day: '2-digit' };
            return new Date(date).toLocaleDateString('en-US', options);
        },

        isGraceOrLordsDay(day) {
            return day === 'Grace Day' || day === `Lord's Day`;
        },
    }))
})

Alpine.start()
