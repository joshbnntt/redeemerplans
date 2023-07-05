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

import * as Turbo from "@hotwired/turbo"
//Turbo.session.drive = false
Turbo.setProgressBarDelay(0)
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
        getPassages(passages, links) {
            if (links) return links
            return passages;
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
                this.registeredMessage = "Check your emaik for a magic link."
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
        async init() {
            await this.$nextTick();
            if (this.$store.auth.user) {
                const { data, error } = await supabase
                    .from('haveread')
                    .select()
                if (error) {
                    console.error(error)
                } else {
                    this.$store.haveread.setDays(data)
                    console.log(data)
                }
            }

        },
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
            const user_id = this.$store.auth.user.id
            const { error } = await supabase
                .from('haveread')
                .insert({ plan_day: day, user_id })
            if (!error) {
                this.init()
            }
        },
        async markUnread(day) {
            const { error } = await supabase
                .from('haveread')
                .delete()
                .eq('plan_day', day)
            if (!error) {
                this.init()
            }
        }
    }))

    Alpine.store('auth', {
        async init() {
            const { data, error } = await supabase.auth.getSession()
            if (error) {
                console.error(error)
            } else if (data) {
                this.session = data.session
                this.user = data.session?.user
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
        }
    })
})

Alpine.start()
