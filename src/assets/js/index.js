import '../css/index.css';
import 'alpine-turbo-drive-adapter'
import Alpine from 'alpinejs'
 
window.Alpine = Alpine

// Add Alpine extensions here
 
Alpine.start()

console.log('hello from index.js')

import * as Turbo from "@hotwired/turbo"

document.addEventListener('alpine:init', () => {
    Alpine.data('thisweek', () => ({ 
        readings: null, 
        title: null, 
        description: null, 
        currentWeek: '', 
        currentWeekEnd: '', 
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
                    this.readings = data.plan; 
                    this.currentWeek = this.getWeekStart(); 
                    this.currentWeekEnd = this.getWeekEnd(); 
                }) 
                .catch(error => { 
                    console.error('Error:', error); 
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