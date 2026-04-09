export function averageOfObjects(arr) {
    const slice = arr.items.slice(-4);
    if (slice.length === 0){
     return 0;
    }else {
        const stars = []
        slice.forEach((league) => {
            stars.push(league.attackStars / (league.attackWins + league.attackLosses))
        })

        const gem = stars
    }
}