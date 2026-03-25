import '../css/index.css';
import 'alpine-turbo-drive-adapter'
import Alpine from 'alpinejs'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://olzxikbosvhduajnlqrh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9senhpa2Jvc3ZoZHVham5scXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODgyNjI0NDcsImV4cCI6MjAwMzgzODQ0N30.mkmueypBvRUEPQWIqnSk_NDAu0s8lbZ-mpTQCzBz-sg'
const supabase = createClient(supabaseUrl, supabaseKey)

window.Alpine = Alpine

// Add Alpine extensions here

console.log('hello from index.js')

window.updateTheme = function () {
if (localStorage.theme === 'dark' || (!('theme' in localStorage) 
    && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
    document.documentElement.dataset.theme = 'mydarktheme'
} else {
    document.documentElement.classList.remove('dark')
    document.documentElement.dataset.theme = 'mytheme'
}
}

window.updateTheme()

const TRANSLATIONS = {
    'KJV': "1",
    'ESV': "59",
    'CSB': "1713",
    'NASB': "2692",
    'LSB': "3345",
    'NIV': "111",
    'NKJV': "114",
    'NLT': "116"
}

import * as Turbo from "@hotwired/turbo"
Turbo.session.drive = false
Turbo.setProgressBarDelay(0)
document.addEventListener('alpine:init', () => {
    console.log("alpine:init")

    Alpine.data('userProfile', () => ({
        count: 0,
        yearCount: 0,
        async init() {
            await this.fetchData()
            setInterval(() => this.fetchData(), 1000 * 60 * 1)
        },
        async fetchData() {
            const {error, count} = await supabase.from('haveread').select('*', {count: "exact"})

            if (error) {
                console.error("Error getting reading count: ", error)
                return
            }

            this.count = count

            try {
                const { count:yearCount, error } = await supabase.from('haveread').select('*', {count: "exact"}).ilike('plan_day', `%${new Date().getFullYear()}%`)
            
                if (error) {
                  throw error;
                }
            
                this.yearCount = yearCount
              } catch (error) {
                console.error('Error fetching data:', error.message);
              }
        }
    }))

    Alpine.data('translationSwitcher', () => ({
        selected: TRANSLATIONS.ESV,
        init() {
            const t = localStorage.translation
            console.log("t1", t)
            if(!t) {
                localStorage.setItem('translation', this.selected)
                this.$store.bible.translation = this.selected
            } else {
                this.selected = t
            }
        },
        save() {
            localStorage.setItem('translation', this.selected)
            this.$store.bible.translation = this.selected
        },
        get name() {
            return Object.keys(TRANSLATIONS)[Object.values(TRANSLATIONS).indexOf(this.selected)]
        }
    }))
    Alpine.data('thisweek', () => ({
        isLoading: true,
        error: null,
        data: null,
        readings: null,
        title: null,
        description: null,
        currentWeek: '',
        currentWeekEnd: '',
        offset: 0,
        hasNextWeek: false,
        hasPrevWeek: false,
        get books() {
            return window.bookAbbreviations;
        },
        incrementOffset() {
            this.offset += 1
            this.setupWeek()
        },
        decrementOffset(){
            this.offset += -1
            this.setupWeek()
        },
        resetWeek() {
            this.offset = 0
            this.setupWeek()
        },
        getPassages(passages, links) {
            if (links) return links.replace(/\/59\//g, `/${this.$store.bible.translation}/`)
            return passages;
        },
        getWeekStart() {
            const today = new Date();
            if (this.offset !== 0){
                today.setDate(today.getDate() + this.offset * 7)
            }
            const start = today.getDate() - today.getDay();
            const weekStart = new Date(today.setDate(start || 1));
            let ws = weekStart.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            
            return ws
        },
        getWeekEnd() {
            const weekStart = new Date(this.getWeekStart());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6); // Assuming a week ends on the 7th day 

            return weekEnd.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        },
        fetchPlan() {
            fetch('/api/current.json')
                .then(response => response.json())
                .then(data => {
                    this.data = data
                    this.setupWeek()
                })
                .catch(e => {
                    this.isLoading = false;
                    console.error('Error:', e);
                    this.error = e.message;
                });
        },
        setupWeek() {
            try {
                this.isLoading = true;
                this.title = this.data.title;
                this.description = this.data.description;

                this.currentWeek = this.getWeekStart();
                this.currentWeekEnd = this.getWeekEnd();
                this.readings = this.data.plan.filter(reading => reading.readingdate !== '' && reading.readingdate >= this.currentWeek && reading.readingdate <= this.currentWeekEnd);

                this.checkNextPrev()               

                this.isLoading = false;
            } catch (e) {
                console.error(e)
                this.error. e.message
            }
        },    
        checkNextPrev() {
            const today = new Date();
            const next = new Date();
            const prev = new Date();

            next.setDate(today.getDate() + (this.offset + 1) * 7)
            this.hasNextWeek = this.data.plan.some(reading => reading.readingdate !== '' && reading.readingdate === next.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }))
            
            prev.setDate(today.getDate() + (this.offset - 1) * 7)
            this.hasPrevWeek = this.data.plan.some(reading => reading.readingdate !== '' && reading.readingdate === prev.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }))
        },
        formatDate(date) {
            const options = { month: '2-digit', day: '2-digit', year: 'numeric' };
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
    Alpine.data("login", () => ({
        registered: false,
        registeredMessage: "Check your email for confirmation.",
        error: false,
        errorMessage: "",
        async submit(event) {
            const formElem = event.target
            const formData = new FormData(formElem);
            const email = formData.get("email")
            if (email) {

                const { data, error } = await supabase.auth.signInWithOtp({
                  email,
                  options: {
                    emailRedirectTo: 'https://redeemerbiblereading.info/thisweek/'
                   }
               })
               if (error) {
                console.error(error)
                this.error = true
                this.errorMessage = error.message
               } else {
                formElem.reset()
                this.registered = true
                this.registeredMessage = "Check your email for a magic link."
               }
            }
            
        }
    }))
    Alpine.data("logout", () => ({
        async logout() {
            const { error } = await supabase.auth.signOut()
            if (!error) {
                this.$store.auth.setSession(null)
                this.$store.auth.setUser(null)
            }
        }
    }))
    Alpine.data("readings", () => ({

        check(e) {
            const checkboxElem = e.target
            console.log(checkboxElem)
            if (checkboxElem.checked) {
                this.markRead(this.day)
            } else {
                this.markUnread(this.day)
            }
        },
        async markRead(day) {
            await this.$store.haveread.markRead(day)
        },
        async markUnread(day) {
            await this.$store.haveread.markUnread(day)
        }
    }))
    Alpine.data('today', () => ({
      todayDate: '',
      todayReading: null,
      async init() {
        
        const date = new Date()
        this.todayDate = date.toLocaleDateString('en-us', {day: "2-digit", month: "2-digit", year:"numeric"})
        const res = await fetch("/api/current.json")  
        const data = await res.json()
        this.todayReading = data.plan.filter(r => r.readingdate === this.todayDate)[0]
      },
      getPassages(passages, links) {
          if (links) return links.replace(/\/59\//g, `/${this.$store.bible.translation}/`)
          return passages;
      },
    }))

    Alpine.store('bible', {
        translation: '59'
    })

    Alpine.store('auth', {
        async init() {
            const { data, error } = await supabase.auth.getSession()
            if (error) {
                console.error(error)
            } else if (data) {
                this.session = data.session
                this.user = data.session?.user
                Alpine.store('haveread').fetchReadings()
            }
        },
        user: null,
        setUser(user) {
            this.user = user
        },
        session: null,
        setSession(session) {
            this.session = session
        }
    })
    Alpine.store('haveread', {
        days: null,
        setDays(days) {
            this.days = days
        },
        async fetchReadings() {
            console.log("fetchingReadings");
            
            let allData = [];
            let keepFetching = true;
            let offset = 0;
            const limit = 1000; // Supabase's default max

            while (keepFetching) {
                const { data, error } = await supabase
                    .from('haveread')
                    .select()
                    // Fetch in chunks of 1000
                    .range(offset, offset + limit - 1); 

                if (error) {
                    console.error("Error fetching readings:", error);
                    keepFetching = false;
                    return; // Exit early if there's an error
                }

                // Add the new chunk of data to our main array
                allData = [...allData, ...data];

                // If the data returned is less than the limit, we've hit the end of the records
                if (data.length < limit) {
                    keepFetching = false;
                } else {
                    // Otherwise, bump the offset and fetch the next 1000
                    offset += limit;
                }
            }

            this.setDays(allData);
            console.log(`Got all data: ${allData.length} records`);
        },
        async markRead(day) {
            if(!Alpine.store('auth')?.user?.id) throw new Error('must be logged in')
            
            const { error } = await supabase
                .from('haveread')
                .insert({ plan_day: day, user_id: Alpine.store('auth').user.id })
            if (!error) {
                this.fetchReadings()
            } else {
                console.error(error)
            }
        },
        async markUnread(day) {
            const { error } = await supabase
                .from('haveread')
                .delete()
                .eq('plan_day', day)
            if (!error) {
                this.fetchReadings()
            } else {
                console.error(error)
            }
        }
    })
})

Alpine.start()

if ('serviceWorker' in navigator) {
    //navigator.serviceWorker.register('assets/js/service-worker.js');
    navigator.serviceWorker.register('/sw.js');
}
