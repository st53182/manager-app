class TranslationManager {
    constructor() {
        this.supportedLanguages = ['ru', 'lv', 'en'];
        const savedLanguage = localStorage.getItem('language') || 'ru';
        this.currentLanguage = this.supportedLanguages.includes(savedLanguage) ? savedLanguage : 'ru';
        this.defaultLanguage = 'en';
        this.translations = {};
        this.loadTranslations();
    }

    async loadTranslations() {
        try {
            const [ruResponse, lvResponse, enResponse] = await Promise.all([
                fetch('/translations/ru.json'),
                fetch('/translations/lv.json'),
                fetch('/translations/en.json')
            ]);
            
            this.translations.ru = await ruResponse.json();
            this.translations.lv = await lvResponse.json();
            this.translations.en = await enResponse.json();
            
            this.updatePageContent();
            this.updateLanguageSwitcher();
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    }

    setLanguage(language) {
        if (!this.supportedLanguages.includes(language)) {
            return;
        }

        this.currentLanguage = language;
        localStorage.setItem('language', language);
        this.updatePageContent();
        this.updateLanguageSwitcher();
        
        const titleKey = document.querySelector('meta[name="title-key"]')?.content;
        if (titleKey) {
            document.title = this.t(titleKey);
        }
    }

    getNestedValue(obj, key) {
        const keys = key.split('.');
        let value = obj;
        
        for (const k of keys) {
            value = value?.[k];
        }

        return value;
    }

    t(key) {
        const current = this.getNestedValue(this.translations[this.currentLanguage], key);
        if (typeof current !== 'undefined') return current;

        const fallback = this.getNestedValue(this.translations[this.defaultLanguage], key);
        if (typeof fallback !== 'undefined') return fallback;

        const ruFallback = this.getNestedValue(this.translations.ru, key);
        if (typeof ruFallback !== 'undefined') return ruFallback;
        
        return key;
    }

    updatePageContent() {
        document.documentElement.lang = this.currentLanguage;

        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' && element.type !== 'submit' && element.type !== 'button') {
                element.placeholder = translation;
            } else if (element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else if (element.tagName === 'OPTION') {
                element.textContent = translation;
            } else if (element.tagName === 'TITLE') {
                element.textContent = translation;
                document.title = translation;
            } else {
                const hasChildElements = element.children.length > 0;
                if (hasChildElements) {
                    const childNodes = Array.from(element.childNodes);
                    const textNodes = childNodes.filter(node => node.nodeType === Node.TEXT_NODE);
                    
                    if (textNodes.length > 0) {
                        textNodes[0].textContent = translation;
                        for (let i = 1; i < textNodes.length; i++) {
                            textNodes[i].remove();
                        }
                    } else {
                        const textNode = document.createTextNode(translation);
                        element.insertBefore(textNode, element.firstChild);
                    }
                } else {
                    element.textContent = translation;
                }
            }
        });

        document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            element.placeholder = this.t(key);
        });

        document.querySelectorAll('[data-translate-title]').forEach(element => {
            const key = element.getAttribute('data-translate-title');
            element.title = this.t(key);
        });
    }

    updateLanguageSwitcher() {
        const ruBtn = document.getElementById('langRu');
        const lvBtn = document.getElementById('langLv');
        const enBtn = document.getElementById('langEn');
        
        if (ruBtn && lvBtn && enBtn) {
            ruBtn.classList.toggle('bg-blue-100', this.currentLanguage === 'ru');
            ruBtn.classList.toggle('text-blue-700', this.currentLanguage === 'ru');
            ruBtn.classList.toggle('text-gray-600', this.currentLanguage !== 'ru');

            lvBtn.classList.toggle('bg-blue-100', this.currentLanguage === 'lv');
            lvBtn.classList.toggle('text-blue-700', this.currentLanguage === 'lv');
            lvBtn.classList.toggle('text-gray-600', this.currentLanguage !== 'lv');
            
            enBtn.classList.toggle('bg-blue-100', this.currentLanguage === 'en');
            enBtn.classList.toggle('text-blue-700', this.currentLanguage === 'en');
            enBtn.classList.toggle('text-gray-600', this.currentLanguage !== 'en');
        }
    }

    createLanguageSwitcher() {
        return `
            <div class="flex items-center space-x-2 border-l border-gray-200 pl-4">
                <button id="langRu" class="px-2 py-1 text-sm rounded transition-colors ${this.currentLanguage === 'ru' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-blue-600'}">
                    RU
                </button>
                <button id="langLv" class="px-2 py-1 text-sm rounded transition-colors ${this.currentLanguage === 'lv' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-blue-600'}">
                    LV
                </button>
                <button id="langEn" class="px-2 py-1 text-sm rounded transition-colors ${this.currentLanguage === 'en' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-blue-600'}">
                    EN
                </button>
            </div>
        `;
    }

    initializeLanguageSwitcher() {
        const languageSwitcher = document.getElementById('languageSwitcher');
        if (languageSwitcher) {
            languageSwitcher.innerHTML = this.createLanguageSwitcher();
            
            document.getElementById('langRu')?.addEventListener('click', () => {
                this.setLanguage('ru');
            });

            document.getElementById('langLv')?.addEventListener('click', () => {
                this.setLanguage('lv');
            });
            
            document.getElementById('langEn')?.addEventListener('click', () => {
                this.setLanguage('en');
            });
        }
    }
}

window.translationManager = new TranslationManager();

document.addEventListener('DOMContentLoaded', () => {
    window.translationManager.initializeLanguageSwitcher();
});
