export function fetchRequest(path, body, callback){
    fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: body
    })
        .then(response => response.json())
        .then(data => {callback(data)})
        .catch(error => console.log(error));
}

export async function databaseRequest(path, body){
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

export async function getRequest(path) {
    const request = await fetch(path, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    return await request.json();
}
