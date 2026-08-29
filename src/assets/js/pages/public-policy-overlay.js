import { getLanguage } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { publicPolicyExtraLocales } from '../i18n/public-policy-extra-locales.js';
import { _BASE_URL } from '../Data/config.js';

function setMeta(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.setAttribute('content', value);
}

function readScreenshot(file, feedback) {
    if (!file) return Promise.resolve('');
    if (!file.type.startsWith('image/') || file.size > 500_000) {
        return Promise.reject(new Error(feedback.imageError));
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error(feedback.readError));
        reader.readAsDataURL(file);
    });
}

function createFeedbackForm(feedback) {
    const section = document.createElement('section');
    section.className = 'feedback-form-section';
    section.innerHTML = `
        <h2>${feedback.title}</h2>
        <form class="feedback-form" novalidate>
            <input class="feedback-honeypot" name="website" tabindex="-1" autocomplete="off" aria-label="${feedback.honeypot}">
            <label>${feedback.category}<select name="category" required><option value="bug">Bug</option><option value="feature">${feedback.feature}</option><option value="account">Account</option><option value="privacy">Privacy</option><option value="other">${feedback.other}</option></select></label>
            <label>${feedback.page}<input name="pagePath" value="${location.pathname}" maxlength="300"></label>
            <label>${feedback.description}<textarea name="description" minlength="10" maxlength="4000" rows="7" required></textarea></label>
            <label>${feedback.email}<input name="contactEmail" type="email" maxlength="254" autocomplete="email"></label>
            <label>${feedback.screenshot}<input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp"></label>
            <p class="feedback-privacy">${feedback.privacy}</p>
            <button class="button button-primary" type="submit">${feedback.send}</button>
            <p class="feedback-status" role="status" aria-live="polite"></p>
        </form>`;

    const form = section.querySelector('form');
    const status = section.querySelector('.feedback-status');
    const startedAt = Date.now();
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        status.textContent = feedback.sending;
        try {
            const screenshotData = await readScreenshot(form.elements.screenshot.files?.[0], feedback);
            const response = await fetch(`${_BASE_URL}/Feedback`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: form.elements.category.value,
                    pagePath: form.elements.pagePath.value,
                    description: form.elements.description.value,
                    contactEmail: form.elements.contactEmail.value,
                    website: form.elements.website.value,
                    screenshotData,
                    startedAt
                })
            });
            if (!response.ok) throw new Error(feedback.failed);
            form.reset();
            status.textContent = feedback.sent;
        } catch (error) {
            status.textContent = error instanceof Error ? error.message : feedback.failed;
        } finally {
            button.disabled = false;
        }
    });
    return section;
}

function renderExtraPolicy() {
    const root = document.querySelector('[data-policy-document]');
    if (!root) return;

    const language = getLanguage();
    const locale = publicPolicyExtraLocales[language];
    if (!locale) return;

    const page = root.dataset.policyDocument;
    const copy = locale[page];
    if (!copy) return;

    document.title = `${copy.title} · ClashPanel`;
    setMeta('meta[name="description"]', copy.description);
    setMeta('meta[property="og:title"]', `${copy.title} · ClashPanel`);
    setMeta('meta[property="og:description"]', copy.description);
    setMeta('meta[name="twitter:title"]', `${copy.title} · ClashPanel`);
    setMeta('meta[name="twitter:description"]', copy.description);

    root.replaceChildren();
    root.dataset.renderedLanguage = language;

    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = copy.title;
    const summary = document.createElement('p');
    summary.textContent = copy.summary;
    header.append(title, summary);
    if (page !== 'contact') {
        const updated = document.createElement('p');
        updated.textContent = `${language === 'fr' ? 'Dernière mise à jour' : language === 'de' ? 'Zuletzt aktualisiert' : 'Última actualización'}: ${locale.lastUpdated}`;
        header.appendChild(updated);
    }
    root.appendChild(header);

    const toc = document.createElement('nav');
    toc.className = 'policy-toc';
    toc.setAttribute('aria-label', locale.tocLabel);
    const tocTitle = document.createElement('strong');
    tocTitle.textContent = locale.tocTitle;
    toc.appendChild(tocTitle);
    root.appendChild(toc);

    copy.sections.forEach(([heading, paragraphs], index) => {
        const section = document.createElement('section');
        section.id = `section-${index + 1}`;
        const sectionTitle = document.createElement('h2');
        sectionTitle.textContent = heading;
        const list = document.createElement('ul');
        paragraphs.forEach(paragraph => {
            const item = document.createElement('li');
            item.textContent = paragraph;
            list.appendChild(item);
        });
        section.append(sectionTitle, list);
        root.appendChild(section);

        const link = document.createElement('a');
        link.href = `#${section.id}`;
        link.textContent = heading;
        toc.appendChild(link);
    });

    if (copy.links?.length) {
        const actions = document.createElement('div');
        actions.className = 'policy-actions';
        copy.links.forEach(([label, url]) => {
            const link = document.createElement('a');
            link.href = url;
            link.className = 'button button-secondary';
            link.textContent = label;
            if (/^https?:/i.test(url)) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
            actions.appendChild(link);
        });
        root.appendChild(actions);
    }

    if (page === 'contact' && copy.feedback) {
        root.appendChild(createFeedbackForm(copy.feedback));
    }
}

export function initPublicPolicyOverlay() {
    if (!document.querySelector('[data-policy-document]')) return;

    const scheduleRender = () => window.setTimeout(renderExtraPolicy, 0);
    scheduleRender();
    window.setTimeout(() => {
        window.addEventListener('clashtools:language-changed', scheduleRender);
    }, 0);
}
