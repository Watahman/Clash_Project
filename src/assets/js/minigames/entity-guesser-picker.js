export function createEntityAnswerPicker({
    elements,
    getEntities,
    searchEntities,
    appendImage,
    text,
    setMessage,
    isComplete
}) {
    let suggestions = [];
    let activeIndex = -1;
    let selectedId = '';

    function setOpen(open) {
        const visible = Boolean(open && !isComplete());
        elements.suggestions.hidden = !visible;
        elements.input.setAttribute('aria-expanded', String(visible));
        if (!visible) {
            activeIndex = -1;
            elements.input.removeAttribute('aria-activedescendant');
        }
    }

    function chooseSuggestion(entity) {
        if (!entity) return;
        selectedId = entity.id;
        elements.input.value = entity.name;
        setOpen(false);
        setMessage('');
    }

    function createSuggestion(entity) {
        const option = document.createElement('button');
        option.type = 'button';
        option.tabIndex = -1;
        option.id = `entity-suggestion-${entity.id}`;
        option.className = 'entity-suggestion';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.dataset.entityId = entity.id;

        const label = document.createElement('span');
        label.textContent = entity.name;
        option.append(label);
        appendImage(option, entity, 'suggestion-entity-image');
        option.addEventListener('pointerdown', event => event.preventDefault());
        option.addEventListener('click', () => chooseSuggestion(entity));
        return option;
    }

    function render(open = true, query = elements.input.value) {
        const entities = getEntities();
        elements.suggestions.replaceChildren();
        suggestions = searchEntities(query, entities, entities.length);
        activeIndex = -1;
        elements.input.removeAttribute('aria-activedescendant');
        elements.pickerHelp.textContent = `${entities.length} ${text('availableAnswers')}`;

        if (!suggestions.length) {
            const empty = document.createElement('div');
            empty.className = 'entity-suggestions-empty';
            empty.setAttribute('role', 'option');
            empty.setAttribute('aria-disabled', 'true');
            empty.textContent = text('noMatches');
            elements.suggestions.append(empty);
        } else {
            suggestions.forEach(entity => elements.suggestions.append(createSuggestion(entity)));
        }
        setOpen(open);
    }

    function reopen() {
        const selected = getEntities().find(entity => (
            entity.id === selectedId && entity.name === elements.input.value
        ));
        if (selected) {
            elements.input.select();
            render(true, '');
            return;
        }
        render(true);
    }

    function move(direction) {
        if (elements.suggestions.hidden) {
            render(true, selectedId ? '' : elements.input.value);
        }
        if (!suggestions.length) return;

        activeIndex = (activeIndex + direction + suggestions.length) % suggestions.length;
        const options = [...elements.suggestions.querySelectorAll('.entity-suggestion')];
        options.forEach((option, index) => {
            const active = index === activeIndex;
            option.classList.toggle('is-active', active);
            option.setAttribute('aria-selected', String(active));
        });

        const active = options[activeIndex];
        elements.input.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView?.({ block: 'nearest' });
    }

    function handleKeyDown(event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            move(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Enter' && !elements.suggestions.hidden && activeIndex >= 0) {
            event.preventDefault();
            chooseSuggestion(suggestions[activeIndex]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        }
    }

    function bind() {
        elements.input.addEventListener('focus', reopen);
        elements.input.addEventListener('click', reopen);
        elements.input.addEventListener('input', () => {
            selectedId = '';
            render(true);
        });
        elements.input.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', event => {
            if (!elements.picker.contains(event.target)) setOpen(false);
        });
    }

    return {
        bind,
        clearSelection: () => { selectedId = ''; },
        render,
        setOpen,
        reopen,
        move
    };
}
