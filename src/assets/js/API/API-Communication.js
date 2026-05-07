export async function fetchClashAPIRequest(path, body){
    return fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: body
    })
        .then(response => response.json())
        .catch(error => console.log(error));
}

export async function databaseRequestWithBody(path, body){
    return fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
        .then(response => response.json())
        .catch(error => console.log(error));
}

export async function databaseRequest(path){
    return fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
    })
        .then(response => response.json())
        .catch(error => console.log(error));
}

export async function getRequest(path) {
    const request = await fetch(path, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    return await request.json();
}
