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