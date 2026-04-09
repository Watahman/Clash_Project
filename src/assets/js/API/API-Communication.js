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