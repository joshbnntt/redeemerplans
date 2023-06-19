import '../css/index.css';
import 'alpine-turbo-drive-adapter'
import Alpine from 'alpinejs'
 
window.Alpine = Alpine

// Add Alpine extensions here
 
Alpine.start()

console.log('hello from index.js')

import * as Turbo from "@hotwired/turbo"