// customCitySelector.js

const createStyle = () => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        city-selector {
            display: block;
            width: 100%;
        }
        .city-selector-container {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            width: 100%;
        }
        .city-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #333;
            margin-bottom: 8px;
            font-family: inherit;
        }
        .city-input-wrapper {
            position: relative;
            width: 100%;
        }
        .city-input {
            width: 100%;
            appearance: none;
            border: none;
            border-bottom: 1px solid #929292;
            border-radius: 0;
            padding: 10px 32px 15px 0;
            font-size: 16px;
            color: #333;
            background: transparent;
            outline: none;
            cursor: text;
            box-sizing: border-box;
            font-family: inherit;
            transition: border-color 0.15s ease;
        }
        .city-input::placeholder {
            color: #929292;
        }
        .city-input:disabled {
            color: #929292;
            cursor: not-allowed;
            border-bottom-color: #929292;
        }
        .city-input:focus {
            border-bottom-color: #333;
        }
        .dropdown-icon {
            position: absolute;
            right: 4px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            color: #000;
            transition: transform 0.2s ease;
        }
        .dropdown-icon.open {
            transform: translateY(-50%) rotate(180deg);
        }
        .selected-cities {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
            min-height: 0;
        }
        .city-tag {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px 6px 14px;
            background: #B8985A;
            color: #fff;
            border: 1.5px solid #B8985A;
            border-radius: 100px;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            user-select: none;
            transition: opacity 0.15s;
        }
        .city-tag:hover {
            opacity: 0.88;
        }
        .city-tag .remove-btn {
            cursor: pointer;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: background 0.15s, transform 0.15s;
        }
        .city-tag .remove-btn:hover {
            background: rgba(255, 255, 255, 0.38);
            transform: scale(1.15);
        }
        .suggestions-dropdown {
            position: absolute;
            top: calc(100% + 2px);
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            max-height: 240px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }
        .suggestions-dropdown.active {
            display: block;
        }
        .suggestion-item {
            padding: 10px 14px;
            cursor: pointer;
            border-bottom: 1px solid #f3f3f3;
            font-size: 15px;
            color: #333;
            transition: background 0.1s;
        }
        .suggestion-item:last-child {
            border-bottom: none;
        }
        .suggestion-item:hover {
            background: #f7f7f7;
        }
        .no-results {
            padding: 12px 14px;
            text-align: center;
            color: #929292;
            font-size: 14px;
        }
    `;
    return styleElement;
};

// SVG × icon for remove button
const xIcon = `
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
         stroke="#fff" stroke-width="2" stroke-linecap="round">
        <line x1="2" y1="2" x2="8" y2="8"/>
        <line x1="8" y1="2" x2="2" y2="8"/>
    </svg>`;

// Thin chevron icon
const chevronIcon = `
    <svg class="dropdown-icon" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
    </svg>`;

class CitySelector extends HTMLElement {
    constructor() {
        super();
        this.allCities = [];
        this.selectedCities = [];
        this.isEnabled = false;
    }

    connectedCallback() {
        this.appendChild(createStyle());

        const container = document.createElement('div');
        container.className = 'city-selector-container';
        container.innerHTML = `
            <label class="city-label">City</label>
            <div class="city-input-wrapper">
                <input 
                    type="text" 
                    class="city-input"
                    id="cityInput" 
                    placeholder="Select a country first..."
                    disabled
                />
                ${chevronIcon}
                <div class="suggestions-dropdown" id="suggestionsDropdown"></div>
            </div>
            <div class="selected-cities" id="selectedCities"></div>
        `;

        this.appendChild(container);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const cityInput = this.querySelector('#cityInput');
        const suggestionsDropdown = this.querySelector('#suggestionsDropdown');
        const chevron = this.querySelector('.dropdown-icon');

        cityInput.addEventListener('click', () => {
            if (!this.isEnabled || this.allCities.length === 0) return;
            if (cityInput.value.trim() === '') {
                this.displaySuggestions(this.getAvailableCities());
            }
        });

        cityInput.addEventListener('input', () => {
            if (!this.isEnabled) return;
            const query = cityInput.value.toLowerCase().trim();
            if (query.length < 1) {
                this.displaySuggestions(this.getAvailableCities());
                return;
            }
            const filtered = this.allCities.filter(city =>
                city.name.toLowerCase().includes(query) &&
                !this.selectedCities.some(s => s.name === city.name)
            );
            this.displaySuggestions(filtered);
        });

        cityInput.addEventListener('focus', () => {
            if (!this.isEnabled) return;
            if (chevron) chevron.classList.add('open');
            if (cityInput.value.trim() === '') {
                this.displaySuggestions(this.getAvailableCities());
            }
        });

        cityInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (chevron) chevron.classList.remove('open');
            }, 200);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.city-selector-container')) {
                suggestionsDropdown.classList.remove('active');
                if (chevron) chevron.classList.remove('open');
            }
        });
    }

    getAvailableCities() {
        return this.allCities.filter(city =>
            !this.selectedCities.some(s => s.name === city.name)
        );
    }

    displaySuggestions(cities) {
        const suggestionsDropdown = this.querySelector('#suggestionsDropdown');

        if (cities.length === 0) {
            suggestionsDropdown.innerHTML = '<div class="no-results">No cities found</div>';
            suggestionsDropdown.classList.add('active');
            return;
        }

        suggestionsDropdown.innerHTML = cities.slice(0, 15).map(city => `
            <div class="suggestion-item" data-city='${JSON.stringify(city)}'>
                ${city.name}
            </div>
        `).join('');

        suggestionsDropdown.classList.add('active');

        this.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const city = JSON.parse(item.dataset.city);
                this.addCity(city);
            });
        });
    }

    addCity(city) {
        if (!this.selectedCities.some(c => c.name === city.name)) {
            this.selectedCities.push(city);
            this.renderSelectedCities();
            this.querySelector('#cityInput').value = '';
            this.querySelector('#suggestionsDropdown').classList.remove('active');
            this.notifyWix();
            console.log('➕ City added:', city.name);
        }
    }

    removeCity(index) {
        const removed = this.selectedCities[index];
        this.selectedCities.splice(index, 1);
        this.renderSelectedCities();
        this.notifyWix();
        console.log('➖ City removed:', removed.name);
    }

    renderSelectedCities() {
        const container = this.querySelector('#selectedCities');

        if (this.selectedCities.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.selectedCities.map((city, index) => `
            <div class="city-tag">
                <span>${city.name}</span>
                <span class="remove-btn" data-index="${index}">${xIcon}</span>
            </div>
        `).join('');

        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.removeCity(index);
            });
        });
    }

    notifyWix() {
        this.dispatchEvent(new CustomEvent('citiesChanged', {
            detail: {
                cities: this.selectedCities.map(c => c.name),
                count: this.selectedCities.length
            }
        }));
        console.log('📤 Notified Wix:', this.selectedCities.length, 'cities');
    }

    get cities() { return this.getAttribute('cities'); }
    set cities(value) { this.setAttribute('cities', value); }
    get reset() { return this.getAttribute('reset'); }
    set reset(value) { this.setAttribute('reset', value); }

    static get observedAttributes() {
        return ['cities', 'reset', 'prepopulate'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'cities' && newValue) {
            try {
                const cities = JSON.parse(newValue);
                this.allCities = cities || [];
                this.isEnabled = true;
                const cityInput = this.querySelector('#cityInput');
                if (cityInput) {
                    cityInput.disabled = false;
                    cityInput.placeholder = 'Search cities...';
                }
                console.log('✅ Cities loaded:', this.allCities.length);
            } catch (e) {
                console.error('❌ Error parsing cities:', e);
            }
        }

        if (name === 'reset' && newValue === 'true') {
            this.allCities = [];
            this.selectedCities = [];
            this.isEnabled = false;
            const cityInput = this.querySelector('#cityInput');
            if (cityInput) {
                cityInput.disabled = true;
                cityInput.value = '';
                cityInput.placeholder = 'Select a country first...';
            }
            const chevron = this.querySelector('.dropdown-icon');
            if (chevron) chevron.classList.remove('open');
            const suggestionsDropdown = this.querySelector('#suggestionsDropdown');
            if (suggestionsDropdown) suggestionsDropdown.classList.remove('active');
            this.renderSelectedCities();
            console.log('🔄 Cities reset');
        }

        if (name === 'prepopulate' && newValue) {
            try {
                const cityNames = JSON.parse(newValue);
                console.log('📍 Prepopulating cities:', cityNames);

                cityNames.forEach(cityName => {
                    const city = this.allCities.find(c => c.name === cityName);
                    if (city && !this.selectedCities.some(s => s.name === city.name)) {
                        this.selectedCities.push(city);
                    }
                });

                this.isEnabled = true;
                const cityInput = this.querySelector('#cityInput');
                if (cityInput) cityInput.disabled = false;

                this.renderSelectedCities();
                this.notifyWix();
                console.log('✅ Prepopulated', this.selectedCities.length, 'cities');
            } catch (e) {
                console.error('❌ Error prepopulating cities:', e);
            }
        }
    }
}

customElements.define('city-selector', CitySelector);