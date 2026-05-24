export function openProfileDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("profileDB", 1);

        request.onupgradeneeded = event => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("profileStore")) {
                db.createObjectStore("profileStore", { keyPath: "key" });
            }
        };

        request.onsuccess = event => {
            resolve(event.target.result);
        };

        request.onerror = event => {
            reject(event.target.error);
        };
    });
}

export async function saveProfileData(key, data) {
    const db = await openProfileDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("profileStore", "readwrite");
        const store = transaction.objectStore("profileStore");

        store.put({
            key: key,
            value: data,
            updatedAt: Date.now()
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject(event.target.error);
    });
}

export async function getProfileData(key) {
    const db = await openProfileDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("profileStore", "readonly");
        const store = transaction.objectStore("profileStore");

        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = event => reject(event.target.error);
    });
}

export async function deleteProfileData(key) {
    const db = await openProfileDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("profileStore", "readwrite");
        const store = transaction.objectStore("profileStore");

        store.delete(key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject(event.target.error);
    });
}

export async function clearProfileData() {
    const db = await openProfileDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("profileStore", "readwrite");
        const store = transaction.objectStore("profileStore");

        store.clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject(event.target.error);
    });
}