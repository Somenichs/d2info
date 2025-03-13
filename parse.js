const axios = require('axios');
const fs = require('fs');
const {parse} = require('kvparser');

function parseKeyValuePairs(data) {
    return parse(data)
    let obj = {};
    let stack = [];
    let key = null;
    let currentObj = obj;

    data.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('//')) return;

        if (line.startsWith('"')) {
            let parts = line.split('"');

            if (parts.length >= 2) {
                key = parts[1];
                let value = parts.length > 3 ? parts[3] : null;
                currentObj[key] = value;
            }
        } else if (line.startsWith('{')) {
            if (key) {
                let newObj = {};
                currentObj[key] = newObj;
                stack.push(currentObj);
                currentObj = newObj;
                key = null;
            }
        } else if (line.startsWith('}')) {
            if (stack.length > 0) {
                currentObj = stack.pop();
            }
        }
    });

    return obj;
}


async function fetchData(url) {
    try {
        const response = await axios.get(url);

        return parseKeyValuePairs(response.data);
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}


async function combineAbilities(urls) {
    let combinedAbilities = {};

    const promises = []
    for (const url of urls) {
        promises.push((async() => {
            return fetchData(url);
        })())
    }
    const responseData = await Promise.allSettled(promises)


    for (const res of responseData)
    {
        if (res.status == 'fulfilled')
        {
            const data = res.value
            const abilities = data['DOTAAbilities'];
            if (abilities) {
                Object.assign(combinedAbilities, abilities);
            }
        }
        if (res.status == 'rejected')
        {
            console.log('Error: ', res.reason)
        }
    }

    return { DOTAAbilities: combinedAbilities };
}

async function getHeroes()
{
    let urls = [];
    const info = await axios.get('https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/npc_heroes.txt')
    const data = parseKeyValuePairs(info.data)
    for (const key in data.DOTAHeroes)
    {
        if (key.startsWith('npc_dota_hero') && key != 'npc_dota_hero_base')
        {
            urls.push('https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/heroes/'+key+'.txt')
        }
    }
    console.log(`returned urls `)
    return urls
}

async function main() {
    let errorText = 'Error getting heroes:'
    try {
        const heroes = await getHeroes();
        errorText = 'Error combining abilities:'
        const combinatedAbilities = await combineAbilities(heroes)
        errorText = 'Error writing file:'
        const abilities = await fetchData('https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/npc_abilities.txt')
        const items = await fetchData('https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/items.txt')
        const units = await fetchData('https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/npc_units.txt')
        const heroesInfo = await fetchData('https://raw.githubusercontent.com/dotabuff/d2vpkr/master/dota/scripts/npc/npc_heroes.txt')

        fs.writeFileSync('items.json', JSON.stringify(items, null, 4))
        fs.writeFileSync('npc_heroes.json', JSON.stringify(heroesInfo, null, 4))
        fs.writeFileSync('npc_units.json', JSON.stringify(units, null, 4))
        fs.writeFileSync('npc_abilities.json', JSON.stringify(abilities, null, 4))
        fs.writeFileSync('npc_abilities_new.json', JSON.stringify(combinatedAbilities, null, 4))

        console.log('Combined abilities file created successfully.');
    } catch (error) {
        console.log(errorText, error)
    }
   
}
main()