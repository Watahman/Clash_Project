import { withGlobalLoading } from "../utils/loading-state.js";

export async function fetchClashAPIRequest(path, body) {
    return withGlobalLoading(async () => {
        const response = await fetch(path, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: body
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }, "Laden...");
}
