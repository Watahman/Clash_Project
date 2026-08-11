export function createEntityImageRenderer({ getEntityAsset, installImageFallback }) {
    function setImage(image, entity, alt = '') {
        if (!image || !entity) return;
        const entityId = entity.id;
        if (image.dataset.entityId === entityId && image.getAttribute('src')) return;
        image.dataset.entityId = entityId;
        image.alt = alt;
        void getEntityAsset(entity).then(asset => {
            if (!image.isConnected || image.dataset.entityId !== entityId) return;
            image.src = asset.image;
            installImageFallback(image);
        });
    }

    function appendImage(parent, entity, className) {
        const image = document.createElement('img');
        image.className = className;
        image.alt = '';
        image.width = 28;
        image.height = 28;
        image.loading = 'lazy';
        image.setAttribute('aria-hidden', 'true');
        parent.prepend(image);
        setImage(image, entity);
    }

    return { appendImage, setImage };
}
