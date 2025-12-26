'use strict';

// key
const LS_KEY_PRIMARY = 'weather_primary_loc';
const LS_KEY_OTHERS = 'weather_additional_cities';
const LS_KEY_THEME = 'weather_theme';

// emoji
const WEATHER_ICONS = {
    0: '☀️', 1: '⛅️',
    2: '⛅️', 3: '☁️',
    45: '🌫️', 48: '🌫️', //foggy
    51: '🌦', 53: '🌦', 55: '🌦',
    61: '🌧', 63: '🌧', 65: '🌧',
    71: '❄️', 73: '❄️', 75: '❄️',
    80: '🌦', 81: '🌧', 82: '🌧',
    95: '⛈️',
};

const state = {
    primaryLocation: null,
    additionalCities: [],
    isLoading: false,
    isDarkMode: false
};

// DOM
let app, cityInput, suggestionsList, errorLabel, refreshBtn, weatherGrid, themeToggle;

// Aux. funct.
function el(tag, props = {}, children = []) {
    const element = document.createElement(tag);
    
    for (const [key, value] of Object.entries(props)) {
        if (key === 'className') element.className = value;
        else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        }
        else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        }
        else element.setAttribute(key, value);
    }

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof HTMLElement) {
            element.appendChild(child);
        }
    });
    return element;
}

function clearContainer(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

// theme
function initTheme() {
    const savedTheme = localStorage.getItem(LS_KEY_THEME);
    
    if (savedTheme === 'dark') {
        enableDarkMode();
    } else if (savedTheme === 'light') {
        enableLightMode();
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            enableDarkMode();
        } else {
            enableLightMode();
        }
    }
}

function enableDarkMode() {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️';
    themeToggle.title = 'Переключить на светлую тему';
    state.isDarkMode = true;
    localStorage.setItem(LS_KEY_THEME, 'dark');
}

function enableLightMode() {
    document.body.classList.remove('dark-mode');
    themeToggle.textContent = '🌙';
    themeToggle.title = 'Переключить на тёмную тему';
    state.isDarkMode = false;
    localStorage.setItem(LS_KEY_THEME, 'light');
}

function toggleTheme() {
    if (state.isDarkMode) {
        enableLightMode();
    } else {
        enableDarkMode();
    }
}

// API
async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка получения погоды');
    return await response.json();
}

async function searchCity(query) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=ru&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка поиска города');
    const data = await response.json();
    return data.results || [];
}

// localStorage
function saveToLS() {
    localStorage.setItem(LS_KEY_PRIMARY, JSON.stringify(state.primaryLocation));
    localStorage.setItem(LS_KEY_OTHERS, JSON.stringify(state.additionalCities));
}

function loadFromLS() {
    const primary = localStorage.getItem(LS_KEY_PRIMARY);
    const others = localStorage.getItem(LS_KEY_OTHERS);
    if (primary) state.primaryLocation = JSON.parse(primary);
    if (others) state.additionalCities = JSON.parse(others);
}

// display funct.
async function renderWeatherCard(location, isPrimary) {
    const card = el('div', { className: 'weather-card' }, [
        el('div', { className: 'loader' }, ['Загрузка...'])
    ]);
    weatherGrid.appendChild(card);

    try {
        const data = await fetchWeather(location.lat, location.lon);
        clearContainer(card);

        const header = el('div', { className: 'card-header' }, [
            el('span', { className: 'city-name' }, [isPrimary ? '🌍 Текущее местоположение' : `🏙️ ${location.name}`])
        ]);

        if (!isPrimary) {
            header.appendChild(el('button', { 
                className: 'btn-remove',
                title: 'Удалить город',
                onClick: () => removeCity(location.name)
            }, ['🗑️']));
        }

        card.appendChild(header);

        const daysList = el('div', { className: 'forecast-days' });
        
        // Weather for today + 2 days
        for (let i = 0; i < 3; i++) {
            const date = new Date(data.daily.time[i]);
            const dayName = i === 0 ? 'Сегодня' : date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
            const code = data.daily.weather_code[i];
            const icon = WEATHER_ICONS[code] || '❓';
            const maxT = Math.round(data.daily.temperature_2m_max[i]);
            const minT = Math.round(data.daily.temperature_2m_min[i]);

            const forecastDay = el('div', { className: 'forecast-day' }, [
                el('span', { className: 'day-label' }, [dayName]),
                el('span', { className: 'day-icon' }, [icon]),
                el('span', { className: 'day-temp' }, [`${maxT}° / ${minT}°`])
            ]);

            forecastDay.style.opacity = '0';
            forecastDay.style.transform = 'translateY(10px)';
            daysList.appendChild(forecastDay);

            // delayed animation
            setTimeout(() => {
                forecastDay.style.transition = 'opacity 0.3s, transform 0.3s';
                forecastDay.style.opacity = '1';
                forecastDay.style.transform = 'translateY(0)';
            }, i * 100);
        }

        card.appendChild(daysList);
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
        }, 100);

    } catch (err) {
        console.error('Ошибка загрузки погоды:', err);
        clearContainer(card);
        card.appendChild(el('div', { 
            className: 'error-message',
            style: { 
                color: 'var(--error-color)', 
                padding: '20px', 
                textAlign: 'center',
                backgroundColor: 'rgba(245, 101, 101, 0.1)',
                borderRadius: '8px',
                margin: '10px 0'
            } 
        }, ['⚠️ Ошибка загрузки данных о погоде']));
    }
}

function renderAllWeatherCards() {
    clearContainer(weatherGrid);

    if (!state.primaryLocation && state.additionalCities.length === 0) {
        const emptyState = el('div', { className: 'empty-state' }, [
            '📍 Добавьте город или разрешите доступ к геопозиции',
            el('br'),
            el('small', { style: { opacity: 0.7 } }, ['Введите название города в поле выше'])
        ]);
        
        emptyState.style.opacity = '0';
        weatherGrid.appendChild(emptyState);
        
        setTimeout(() => {
            emptyState.style.transition = 'opacity 0.5s';
            emptyState.style.opacity = '1';
        }, 100);
        
        return;
    }

    if (state.primaryLocation) {
        renderWeatherCard(state.primaryLocation, true);
    }
    
    state.additionalCities.forEach(city => {
        renderWeatherCard(city, false);
    });
}

function showSuggestions(cities) {
    clearContainer(suggestionsList);
    
    if (cities.length === 0) {
        suggestionsList.style.display = 'none';
        errorLabel.style.display = 'block';
        errorLabel.textContent = 'Город не найден';
        return;
    }

    errorLabel.style.display = 'none';

    cities.forEach((city, index) => {
        const name = `${city.name}${city.admin1 ? ', ' + city.admin1 : ''} (${city.country})`;
        const item = el('li', { 
            className: 'suggestion-item',
            onClick: () => {
                addLocation(city.name, city.latitude, city.longitude);
                cityInput.value = '';
                suggestionsList.style.display = 'none';
            },
            style: {
                animationDelay: `${index * 0.05}s`,
                opacity: '0',
                transform: 'translateX(-10px)'
            }
        }, [
            el('span', { style: { fontSize: '18px', marginRight: '10px' } }, ['📍']),
            name
        ]);
        
        setTimeout(() => {
            item.style.transition = 'opacity 0.2s, transform 0.2s';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, index * 50);
        
        suggestionsList.appendChild(item);
    });

    suggestionsList.style.display = 'block';
}

// Base funct.
function addLocation(name, lat, lon) {
    const newLoc = { name, lat, lon };

    if (!state.primaryLocation) {
        state.primaryLocation = newLoc;
    } else {
        if (state.additionalCities.some(c => c.name === name)) {
            errorLabel.style.display = 'block';
            errorLabel.textContent = 'Этот город уже добавлен';
            return;
        }
        state.additionalCities.push(newLoc);
    }
    
    saveToLS();
    renderAllWeatherCards();
    errorLabel.style.display = 'none';

    showNotification(`Город "${name}" добавлен!`);
}

function removeCity(name) {
    state.additionalCities = state.additionalCities.filter(c => c.name !== name);
    saveToLS();
    renderAllWeatherCards();

    showNotification(`Город "${name}" удалён`);
}

function showNotification(message) {
    const notification = el('div', {
        style: {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: state.isDarkMode ? '#2d3748' : '#4299e1',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '1000',
            opacity: '0',
            transform: 'translateX(100px)',
            transition: 'opacity 0.3s, transform 0.3s',
            fontSize: '14px'
        }
    }, [message]);

    document.body.appendChild(notification);

    // animation
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function refreshAllData() {
    const loadingIndicator = el('div', { 
        className: 'loader',
        style: {
            textAlign: 'center',
            padding: '40px',
            gridColumn: '1 / -1'
        }
    }, ['🔄 Обновление данных...']);
    
    clearContainer(weatherGrid);
    weatherGrid.appendChild(loadingIndicator);

    setTimeout(() => {
        renderAllWeatherCards();
        showNotification('Данные о погоде обновлены');
    }, 500);
}

// geolocation
function initGeolocation() {
    if (!navigator.geolocation) {
        renderAllWeatherCards();
        showNotification('Геолокация не поддерживается вашим браузером');
        return;
    }

    // showing the download
    const loadingDiv = el('div', { 
        className: 'loader',
        style: {
            textAlign: 'center',
            padding: '40px',
            gridColumn: '1 / -1'
        }
    }, ['📍 Определяем ваше местоположение...']);
    
    clearContainer(weatherGrid);
    weatherGrid.appendChild(loadingDiv);

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            state.primaryLocation = {
                name: 'Текущее местоположение',
                lat: pos.coords.latitude,
                lon: pos.coords.longitude
            };
            saveToLS();
            renderAllWeatherCards();
            showNotification('Ваше местоположение определено');
        },
        (err) => {
            console.log('Доступ к геопозиции отклонен');
            renderAllWeatherCards();
            showNotification('Разрешите доступ к геопозиции для автоматического определения погоды');
        },
        { 
            timeout: 10000,
            enableHighAccuracy: true 
        }
    );
}

// init.
function init() {
    cityInput = document.getElementById('city-input');
    suggestionsList = document.getElementById('suggestions');
    errorLabel = document.getElementById('error-label');
    refreshBtn = document.getElementById('refresh-btn');
    weatherGrid = document.getElementById('weather-grid');
    themeToggle = document.getElementById('theme-toggle');
    
    // initializing the topic
    initTheme();

    loadFromLS();

    refreshBtn.addEventListener('click', refreshAllData);
    themeToggle.addEventListener('click', toggleTheme);
    
    // configuring the debounce search
    let debounceTimer;
    cityInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);
        errorLabel.style.display = 'none';

        if (query.length < 2) {
            suggestionsList.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const cities = await searchCity(query);
                showSuggestions(cities);
            } catch (err) {
                console.error('Ошибка поиска:', err);
                errorLabel.style.display = 'block';
                errorLabel.textContent = 'Ошибка поиска. Проверьте подключение к интернету.';
            }
        }, 500);
    });
    
    // enter to add a city
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = cityInput.value.trim();
            if (query.length >= 2) {
                addLocation(query, 0, 0);
            }
        }
    });
    
    // hiding hints when clicking outside of them
    document.addEventListener('click', (e) => {
        if (!cityInput.contains(e.target) && !suggestionsList.contains(e.target)) {
            suggestionsList.style.display = 'none';
        }
    });
    
    // adding styles for animations
    const style = document.createElement('style');
    const cssText = document.createTextNode(`
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-10px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .notification {
            animation: slideIn 0.3s ease;
        }
    `);
    style.appendChild(cssText);
    document.head.appendChild(style);
    
    // if there is no saved data, we request geolocation.
    if (!state.primaryLocation) {
        initGeolocation();
    } else {
        renderAllWeatherCards();
    }
    
    // adding support for theme
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(LS_KEY_THEME)) {
            if (e.matches) {
                enableDarkMode();
            } else {
                enableLightMode();
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', init);