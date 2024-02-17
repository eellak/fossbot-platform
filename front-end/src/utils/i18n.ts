import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import english from './languages/en.json';
import greek from './languages/gr.json';

const resources = {
    en: {
        translation: english,
    },
    gr: {
        translation: greek,
    },
};

i18n.use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

export default i18n;
