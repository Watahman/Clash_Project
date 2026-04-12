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

export function databaseRequest(path, body){
    fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: body
    })
        .then(response => response.json())
        .then(data => {console.log(data)})
        .catch(error => console.log(error));
}

export async function getRequest(path) {
    const request = await fetch(path, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    return await request.json();
}
